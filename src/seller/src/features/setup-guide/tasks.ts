import type { SetupGuideTask } from '@aisley/ui/portal'

export const tasks: SetupGuideTask[] = [
  {
    "id": "account",
    "title": "Review your storefront",
    "location": "Settings → Account",
    "description": "Check your contact information, shop details, and storefront presentation. Registration already created your Shop; update it here.",
    "automatic": false,
    "links": [
      {
        "label": "Review account",
        "to": "/settings/account"
      }
    ]
  },
  {
    "id": "product",
    "title": "Create your first product",
    "location": "Shop → Products",
    "description": "Save a product draft with its details, pricing, and packed measurements. A draft counts for this step; publish it separately when all required checks pass.",
    "automatic": true,
    "links": [
      {
        "label": "Create product",
        "to": "/products/new"
      },
      {
        "label": "View products",
        "to": "/products"
      }
    ]
  },
  {
    "id": "shipping",
    "title": "Enable a shipping provider",
    "location": "Shop → Shipping providers",
    "description": "Enable an active Logistics provider for your Shop so customers can select it at checkout. Available quotes also depend on coverage and published rates.",
    "automatic": true,
    "links": [
      {
        "label": "Choose providers",
        "to": "/shipping-providers"
      }
    ]
  },
  {
    "id": "inventory",
    "title": "Learn stock management",
    "location": "Shop → Inventory and Low-stock alerts",
    "description": "Use Inventory to review and adjust stock. Low-stock alerts help you find items that need replenishing; product editing does not replace inventory adjustments.",
    "automatic": false,
    "links": [
      {
        "label": "Open inventory",
        "to": "/inventory"
      },
      {
        "label": "View low-stock alerts",
        "to": "/low-stock-alerts"
      }
    ]
  },
  {
    "id": "orders",
    "title": "Learn the order workflow",
    "location": "Orders → Approval, Monitoring, and Pickup",
    "description": "Review incoming orders in Approval. Open an accepted order to prepare its parcels, track progress in Monitoring, and use Pickup for the selected Logistics handoff.",
    "automatic": false,
    "links": [
      {
        "label": "Order approval",
        "to": "/orders/approval"
      },
      {
        "label": "Order monitoring",
        "to": "/orders/monitoring"
      },
      {
        "label": "Pickup orders",
        "to": "/orders/pickup"
      }
    ]
  },
  {
    "id": "help",
    "title": "Find messages and business tools",
    "location": "Communication and Shop → Finance",
    "description": "Use Messages for customer, Logistics, and Courier conversations. Finance contains your account’s financial records; Support tickets is where you can ask for platform help.",
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
