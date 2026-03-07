import type { InventoryState } from "@/lib/wms/inventory";

export interface InventoryRepository {
  load(): Promise<InventoryState>;
  save(state: InventoryState): Promise<void>;
  clear(): Promise<void>;
}
