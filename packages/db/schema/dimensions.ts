// =============================================================================
// DB Schema — Dimension table type exports (DD-31 §5)
// Implements: EP §8, EP §15
// Types mirror DD-31 column names exactly.
// ============================================================================

import type {
  Patient,
  Provider,
  Service,
  Category,
  Location,
  Room,
  DateDim,
  InventoryItem,
  InventoryLot,
  AcquisitionSource,
  MembershipType,
  PatientStatus,
  ProviderRole,
  CompensationModel,
  ProductType,
  RoomType,
} from '@za/shared';

// Re-export entity types as row types for typed query results
export type DimPatientRow = Patient;
export type DimProviderRow = Provider;
export type DimServiceRow = Service;
export type DimCategoryRow = Category;
export type DimLocationRow = Location;
export type DimRoomRow = Room;
export type DimDateRow = DateDim;
export type DimInventoryItemRow = InventoryItem;
export type DimInventoryLotRow = InventoryLot;
export type DimAcquisitionSourceRow = AcquisitionSource;
export type DimMembershipTypeRow = MembershipType;

/** Insert params for dim_patients — matches DD-31 §5.1 columns exactly */
export interface InsertPatientParams {
  tenant_id: string;
  zenoti_patient_id: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  gender?: string;
  phone?: string;
  email?: string;
  acquisition_source_id?: string;
  location_id: string;
  patient_status?: PatientStatus;
}

/** Insert params for dim_providers — matches DD-31 §5.2 columns exactly */
export interface InsertProviderParams {
  tenant_id: string;
  zenoti_employee_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  role: ProviderRole;
  compensation_model?: CompensationModel;
  base_rate?: number;
  commission_rate?: number;
  location_id: string;
  is_active?: boolean;
}

/** Insert params for dim_services — matches DD-31 §5.3 columns exactly */
export interface InsertServiceParams {
  tenant_id: string;
  zenoti_service_id: string;
  service_name: string;
  category_id: string;
  standard_duration_minutes?: number;
  list_price?: number;
  is_active?: boolean;
}

/** Insert params for dim_locations — matches DD-31 §5.5 columns exactly */
export interface InsertLocationParams {
  tenant_id: string;
  zenoti_location_id: string;
  location_name: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  timezone?: string;
  is_active?: boolean;
  is_enabled?: boolean;
}

/** Insert params for dim_rooms — matches DD-31 §5.6 columns exactly */
export interface InsertRoomParams {
  tenant_id: string;
  zenoti_room_id: string;
  room_name: string;
  location_id: string;
  room_type?: RoomType;
  capacity?: number;
  is_active?: boolean;
}

/** Insert params for dim_inventory_items — matches DD-31 §5.8 columns exactly */
export interface InsertInventoryItemParams {
  tenant_id: string;
  zenoti_product_id: string;
  sku?: string;
  product_name: string;
  manufacturer?: string;
  brand_family?: string;
  product_type: ProductType;
  product_subtype?: string;
  unit_of_measure: string;
  units_per_package?: number;
  default_cost?: number;
  default_price?: number;
  is_active?: boolean;
}

/** Insert params for dim_inventory_lots — matches DD-31 §5.9 columns exactly */
export interface InsertInventoryLotParams {
  tenant_id: string;
  item_id: string;
  lot_number: string;
  received_date: string;
  expiration_date: string;
  vendor_id?: string;
  received_quantity: number;
  received_unit_cost: number;
}
