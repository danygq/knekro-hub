export interface Order {
  field: string;
  options?: OrderOptions;
}

export interface OrderOptions {
  ascending?: boolean;
  foreignTable?: string;
}
