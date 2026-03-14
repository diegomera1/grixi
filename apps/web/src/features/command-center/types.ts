// Command Center types

export type KPIMetric = {
  label: string;
  value: number;
  previousValue?: number;
  format: 'number' | 'currency' | 'percentage';
  trend?: 'up' | 'down' | 'neutral';
  trendPercent?: number;
  icon: string;
  color: string;
  module: string;
  sparklineData?: number[];
};

export type CommandCenterData = {
  // Overview KPIs
  revenue: number;
  revenueTrend: number;
  expenses: number;
  expensesTrend: number;
  openPOs: number;
  openPOsTotal: number;
  pendingApproval: number;
  stockOccupancy: number;
  stockOccupancyTrend: number;
  totalProducts: number;
  lowStockCount: number;
  activeUsers: number;
  totalUsers: number;
  vendorCount: number;

  // Warehouse data
  warehouseStats: WarehouseOccupancy[];

  // Activity feed
  recentActivity: ActivityEvent[];

  // Financial sparkline (last 7 days)
  revenueSparkline: number[];
  expenseSparkline: number[];

  // Module health
  moduleHealth: ModuleHealth[];
};

export type WarehouseOccupancy = {
  id: string;
  name: string;
  type: string | null;
  rackCount: number;
  totalPositions: number;
  occupiedPositions: number;
  occupancy: number;
};

export type ActivityEvent = {
  id: string;
  action: string;
  resourceType: string | null;
  createdAt: string;
  userId: string | null;
  userName: string;
  userAvatar: string | null;
  module: string;
};

export type ModuleHealth = {
  module: string;
  label: string;
  status: 'healthy' | 'warning' | 'critical';
  metric: string;
  color: string;
};

export type CommandCenterUser = {
  name: string;
  avatar: string | null;
};
