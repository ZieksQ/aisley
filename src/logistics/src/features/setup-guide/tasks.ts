import type { SetupGuideTask } from '@aisley/ui/portal'

export const tasks: SetupGuideTask[] = [
  {
    "id": "account",
    "title": "Review your organization",
    "location": "Settings → Account",
    "description": "Check your organization details and sole operational hub address and location. Update saved details here before using them for delivery operations.",
    "automatic": false,
    "links": [
      {
        "label": "Review account and hub",
        "to": "/settings/account"
      }
    ]
  },
  {
    "id": "rates",
    "title": "Publish shipping rates",
    "location": "Pricing & rates → Shipping rates",
    "description": "Review the platform tariffs and coverage, then create and publish a rate card with service fees and category rules. A future-effective published card completes this step but cannot price shipments until its effective time.",
    "automatic": true,
    "links": [
      {
        "label": "Open shipping rates",
        "to": "/shipping-rates"
      }
    ]
  },
  {
    "id": "couriers",
    "title": "Learn Courier and vehicle tools",
    "location": "Organization → Courier applications and Vehicles",
    "description": "Review applications addressed to your organization and inspect required evidence before deciding. Vehicles contains current Courier vehicle records. You can learn these screens even when no applications are waiting.",
    "automatic": false,
    "links": [
      {
        "label": "Courier applications",
        "to": "/courier-applications"
      },
      {
        "label": "Manage vehicles",
        "to": "/vehicles"
      }
    ]
  },
  {
    "id": "hub",
    "title": "Learn hub operations",
    "location": "Hub operations → Parcel search, Pickups, Receive at hub, and Sorting",
    "description": "Find tracking references in Parcel search, coordinate first-mile collection in Pickups, record physical receipt at Receive at hub, and organize parcels in Sorting. Follow the shipment’s allowed actions; reading this guide changes no parcel status.",
    "automatic": false,
    "links": [
      {
        "label": "Search parcels",
        "to": "/operations"
      },
      {
        "label": "View pickups",
        "to": "/pickups"
      },
      {
        "label": "Receive at hub",
        "to": "/receive-at-hub"
      },
      {
        "label": "Open Sorting",
        "to": "/sorting"
      }
    ]
  },
  {
    "id": "dispatch",
    "title": "Learn dispatch and confirmation",
    "location": "Transport & delivery → Last-mile dispatch and Delivery confirmations",
    "description": "Use Last-mile dispatch for scheduled final-mile work. Review submitted delivery evidence and completion requests in Delivery confirmations. Company fleet and linehaul tools remain separate workflows.",
    "automatic": false,
    "links": [
      {
        "label": "Last-mile dispatch",
        "to": "/dispatch"
      },
      {
        "label": "Delivery confirmations",
        "to": "/delivery-confirmations"
      }
    ]
  },
  {
    "id": "help",
    "title": "Find messages and business tools",
    "location": "Communication and Organization → Finance",
    "description": "Operational messages keeps your shipment conversations together. Finance contains your organization’s financial workflows. Open Support tickets when you need platform assistance.",
    "automatic": false,
    "links": [
      {
        "label": "Open messages",
        "to": "/messages"
      },
      {
        "label": "Open Finance",
        "to": "/finance"
      },
      {
        "label": "Get support",
        "to": "/support-tickets"
      }
    ]
  }
]
