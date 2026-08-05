import { Request, Response, NextFunction } from "express";
import { pool } from "../../config/database";
import { success } from "../../utils/response";
import { AppError } from "../../utils/errors";
import {
  dashboardTotalOrders,
  dashboardTotalRevenue,
  dashboardPendingOrders,
  dashboardActivePandits,
  dashboardOrdersToday,
  dashboardRevenueToday,
  dashboardRecentOrders,
  dashboardActiveServices,
  dashboardCustomerCounts,
  dashboardAvgOrderValue,
  dashboardCancellationRate,
  dashboardRefundRate,
  dashboardRepeatCustomerRate,
  dashboardPendingAssignments,
} from "../../queries/order.queries";
import {
  trendOrders,
  trendRevenue,
  trendNewUsers,
  topServicesByBookings,
  topServicesByRevenue,
  serviceStatsById,
  panditPerformance,
  categoryBreakdown,
  topCoupons,
} from "../../queries/dashboard.queries";
import {
  viewsTrend,
  topServicesByViews,
  totalServiceViewsInPeriod,
  serviceViewStats,
  userViewHistory,
  countUserViewHistory,
  userViewSummary,
} from "../../queries/analytics.queries";
import { paginate } from "../../utils/pagination";

export const getDashboard = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [
      totalOrders, totalRevenue, pendingOrders, activePandits, ordersToday, revenueToday,
      recentOrders, pendingAssignments, activeServices, customerCounts, avgOrderValue,
      cancellationRate, refundRate, repeatCustomerRate,
    ] = await Promise.all([
      pool.query<{ count: number }>(dashboardTotalOrders),
      pool.query<{ total: number }>(dashboardTotalRevenue),
      pool.query<{ count: number }>(dashboardPendingOrders),
      pool.query<{ count: number }>(dashboardActivePandits),
      pool.query<{ count: number }>(dashboardOrdersToday),
      pool.query<{ total: number }>(dashboardRevenueToday),
      pool.query(dashboardRecentOrders),
      pool.query(dashboardPendingAssignments),
      pool.query<{ count: number }>(dashboardActiveServices),
      pool.query(dashboardCustomerCounts),
      pool.query<{ avg: number }>(dashboardAvgOrderValue),
      pool.query<{ rate: number | null }>(dashboardCancellationRate),
      pool.query<{ rate: number | null }>(dashboardRefundRate),
      pool.query<{ rate: number | null }>(dashboardRepeatCustomerRate),
    ]);

    const customers = customerCounts.rows[0];

    return success(res, {
      total_orders: totalOrders.rows[0].count,
      total_revenue: totalRevenue.rows[0].total,
      pending_orders: pendingOrders.rows[0].count,
      active_pandits: activePandits.rows[0].count,
      orders_today: ordersToday.rows[0].count,
      revenue_today: revenueToday.rows[0].total,
      recent_orders: recentOrders.rows,
      pending_assignments: pendingAssignments.rows,
      active_services: activeServices.rows[0].count,
      total_customers: customers.total,
      active_customers: customers.active,
      new_customers_today: customers.new_today,
      new_customers_this_week: customers.new_this_week,
      new_customers_this_month: customers.new_this_month,
      avg_order_value: avgOrderValue.rows[0].avg,
      cancellation_rate: cancellationRate.rows[0].rate ?? 0,
      refund_rate: refundRate.rows[0].rate ?? 0,
      repeat_customer_rate: repeatCustomerRate.rows[0].rate ?? 0,
    });
  } catch (err) {
    next(err);
  }
};

const PERIOD_MAP: Record<string, string> = { daily: "day", weekly: "week", monthly: "month" };
// How far back to default when from/to aren't given, per period granularity —
// enough points to draw a meaningful chart without the query scanning the
// entire orders table by default.
const DEFAULT_RANGE_DAYS: Record<string, number> = { daily: 30, weekly: 84, monthly: 365 };

export const getTrends = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { metric, period, from, to } = req.query as unknown as {
      metric: "orders" | "revenue" | "users" | "views";
      period: "daily" | "weekly" | "monthly";
      from?: string;
      to?: string;
    };

    const toDate = to ? new Date(`${to}T23:59:59Z`) : new Date();
    const fromDate = from
      ? new Date(`${from}T00:00:00Z`)
      : new Date(toDate.getTime() - DEFAULT_RANGE_DAYS[period] * 24 * 60 * 60 * 1000);

    const queryMap = { orders: trendOrders, revenue: trendRevenue, users: trendNewUsers, views: viewsTrend };
    const result = await pool.query(queryMap[metric], [PERIOD_MAP[period], fromDate, toDate]);

    return success(res, { metric, period, from: fromDate, to: toDate, points: result.rows });
  } catch (err) {
    next(err);
  }
};

export const getTopServices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { by, limit, from, to } = req.query as unknown as {
      by: "bookings" | "revenue" | "views";
      limit: number;
      from?: string;
      to?: string;
    };

    const toDate = to ? new Date(`${to}T23:59:59Z`) : new Date();
    const fromDate = from ? new Date(`${from}T00:00:00Z`) : new Date("2000-01-01");

    const queryMap = { bookings: topServicesByBookings, revenue: topServicesByRevenue, views: topServicesByViews };
    const [result, totalViews] = await Promise.all([
      pool.query(queryMap[by](3), [fromDate, toDate, limit]),
      pool.query<{ total: number }>(totalServiceViewsInPeriod, [fromDate, toDate]),
    ]);
    const total = totalViews.rows[0].total;
    // Every variant returns the same fields now (bookings, revenue, views,
    // unique visitors) — only the ORDER BY differs. traffic_share = this
    // service's views ÷ total views across all services in the period.
    const withShare = result.rows.map((row) => ({
      ...row,
      traffic_share: total > 0 ? Math.round((row.views_count / total) * 10000) / 10000 : 0,
    }));

    return success(res, withShare);
  } catch (err) {
    next(err);
  }
};

export const getServiceStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [statsResult, viewsResult] = await Promise.all([
      pool.query(serviceStatsById, [req.params.id]),
      pool.query(serviceViewStats, [req.params.id]),
    ]);
    if (!statsResult.rows[0]) throw new AppError("NOT_FOUND", "Service not found", 404);

    const stats = statsResult.rows[0];
    const views = viewsResult.rows[0];
    // Conversion = real bookings ÷ views, for this service specifically —
    // an aggregate rate, not a per-visitor "did the person who viewed also book" trace.
    const conversionRate =
      views.total_views > 0 ? Math.round((stats.total_bookings / views.total_views) * 10000) / 10000 : 0;

    return success(res, {
      ...stats,
      total_views: views.total_views,
      unique_visitors: views.unique_visitors,
      conversion_rate: conversionRate,
    });
  } catch (err) {
    next(err);
  }
};

export const getPanditPerformance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit } = req.query as unknown as { limit: number };
    const result = await pool.query(panditPerformance(1), [limit]);
    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
};

export const getCategoryBreakdown = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pool.query(categoryBreakdown);
    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
};

export const getTopCoupons = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit } = req.query as unknown as { limit: number };
    const result = await pool.query(topCoupons(1), [limit]);
    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
};

// "What has this specific user been looking at" — full raw event history
// (paginated, newest first) plus a grouped summary (their most-viewed
// entities). Both scoped to whatever they were logged in as at view time —
// views from before they had an account, or from a session that never sent
// a token, aren't attributable to them (no identity to attribute to yet).
export const getUserViewHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const { limit: safeLimit, offset, meta } = paginate(page, limit);

    const [rows, count, summary] = await Promise.all([
      pool.query(userViewHistory(2, 3), [req.params.id, safeLimit, offset]),
      pool.query<{ count: number }>(countUserViewHistory, [req.params.id]),
      pool.query(userViewSummary, [req.params.id]),
    ]);

    return success(
      res,
      { visits: rows.rows, most_viewed: summary.rows },
      "User view history fetched",
      200,
      meta(count.rows[0].count)
    );
  } catch (err) {
    next(err);
  }
};
