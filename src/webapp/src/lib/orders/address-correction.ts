import type { CustomerAddress } from "../checkout/types";
import type { OrderDetail } from "./types";

type DeliveryAddress = OrderDetail["deliveryAddress"];
const locationFields = [
  "addressLine1", "addressLine2", "barangay", "cityMunicipality",
  "province", "region", "postalCode", "country",
] as const;

function coordinates(address: DeliveryAddress | CustomerAddress): string | null | false {
  const { latitude, longitude } = address;
  if (latitude === null && longitude === null) return null;
  if (typeof latitude !== "string" || typeof longitude !== "string"
    || !latitude.trim() || !longitude.trim()) return false;
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  return `${lat.toFixed(7)}:${lng.toFixed(7)}`;
}

export function canCorrectOrderContact(current: DeliveryAddress, selected: CustomerAddress): boolean {
  if (selected.type === "billing" || !selected.recipientName.trim() || !selected.contactNumber.trim()) return false;
  for (const field of locationFields) {
    const before = (current[field] ?? "").trim();
    const after = (selected[field] ?? "").trim();
    if ((field !== "addressLine2" && (!before || !after)) || before !== after) return false;
  }
  const beforePin = coordinates(current);
  const afterPin = coordinates(selected);
  if (beforePin === false || afterPin === false || beforePin !== afterPin) return false;
  return current.recipientName.trim() !== selected.recipientName.trim()
    || current.contactNumber.trim() !== selected.contactNumber.trim();
}
