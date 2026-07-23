import { Request, Response, NextFunction } from "express";
import { pool } from "../../config/database";
import { success } from "../../utils/response";
import {
  dashboardTotalOrders,
  dashboardTotalRevenue,
  dashboardPendingOrders,
  dashboardActivePandits,
  dashboardOrdersToday,
  dashboardRevenueToday,
  dashboardRecentOrders,
  dashboardPendingAssignments,
} from "../../queries/order.queries";

export const getDashboard = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [totalOrders, totalRevenue, pendingOrders, activePandits, ordersToday, revenueToday, recentOrders, pendingAssignments] =
      await Promise.all([
        pool.query<{ count: number }>(dashboardTotalOrders),
        pool.query<{ total: number }>(dashboardTotalRevenue),
        pool.query<{ count: number }>(dashboardPendingOrders),
        pool.query<{ count: number }>(dashboardActivePandits),
        pool.query<{ count: number }>(dashboardOrdersToday),
        pool.query<{ total: number }>(dashboardRevenueToday),
        pool.query(dashboardRecentOrders),
        pool.query(dashboardPendingAssignments),
      ]);

    return success(res, {
      total_orders: totalOrders.rows[0].count,
      total_revenue: totalRevenue.rows[0].total,
      pending_orders: pendingOrders.rows[0].count,
      active_pandits: activePandits.rows[0].count,
      orders_today: ordersToday.rows[0].count,
      revenue_today: revenueToday.rows[0].total,
      recent_orders: recentOrders.rows,
      pending_assignments: pendingAssignments.rows,
    });
  } catch (err) {
    next(err);
  }
};
