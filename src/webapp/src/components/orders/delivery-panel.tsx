"use client";

import type { OrderDetail } from "@/lib/orders/types";
import { CourierOrderContact } from "@/components/courier-messages/courier-order-contact";

export function DeliveryPanel({ order }: { order: OrderDetail }) {
  const address = order.deliveryAddress;
  return (
    <section aria-labelledby="delivery-heading" className="border border-[#DED7E1] bg-white">
      <div className="border-b border-[#E9E3EB] px-4 py-4">
        <h2 id="delivery-heading" className="text-base font-semibold text-[#2D2231]">
          Delivery address
        </h2>
      </div>
      {order.delivery?.courier ? (
        <dl className="border-b border-[#E9E3EB] px-4 py-4 text-sm">
          <div>
            <dt className="text-[#746978]">Courier handling delivery</dt>
            <dd className="mt-1 font-semibold text-[#342838]">{order.delivery.courier.name}</dd>
            <dd className="mt-0.5 text-[#655A69]">{order.delivery.courier.contactNumber ?? "Contact number unavailable"}</dd>
          </div>
        </dl>
      ) : null}
      <div className="border-b border-[#E9E3EB] px-4 py-4">
        <CourierOrderContact orderId={order.id} />
      </div>
      <address className="px-4 py-4 text-sm not-italic leading-6 text-[#655A69]">
        <strong className="font-semibold text-[#342838]">{address.recipientName}</strong>
        <br />
        {address.contactNumber}
        <br />
        {address.addressLine1}
        {address.addressLine2 ? `, ${address.addressLine2}` : ""}
        <br />
        {address.barangay}, {address.cityMunicipality}
        <br />
        {address.province} {address.postalCode}
        <br />
        {address.country}
      </address>
    </section>
  );
}
