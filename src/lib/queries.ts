import { queryOptions } from "@tanstack/react-query";
import { getAdminData, getPortalData, getWeeklyMenu } from "@/lib/catering.functions";

export const menuQueryOptions = queryOptions({ queryKey: ["weekly-menu"], queryFn: () => getWeeklyMenu() });
export const portalQueryOptions = queryOptions({ queryKey: ["portal-data"], queryFn: () => getPortalData() });
export const adminQueryOptions = queryOptions({ queryKey: ["admin-data"], queryFn: () => getAdminData() });
