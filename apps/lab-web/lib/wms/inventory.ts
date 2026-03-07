export type MovementType = "IN" | "OUT" | "ADJUST";

export type Sku = {
  id: string;
  sku: string;
  name: string;
  createdAt: string;
};

export type Location = {
  id: string;
  zone: string;
  bin: string;
  createdAt: string;
};

export type Movement = {
  id: string;
  sku: string;
  locationId: string;
  type: MovementType;
  quantity: number;
  note?: string;
  createdAt: string;
};

export type InventoryState = {
  skus: Sku[];
  locations: Location[];
  movements: Movement[];
};

export const emptyInventoryState: InventoryState = {
  skus: [],
  locations: [],
  movements: [],
};
