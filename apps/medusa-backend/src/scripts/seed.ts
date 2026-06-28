import type { Link } from "@medusajs/framework/modules-sdk";
import type {
  ExecArgs,
  IFulfillmentModuleService,
  ISalesChannelModuleService,
  IStoreModuleService,
} from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import type { Logger } from "@medusajs/medusa";
import {
  createApiKeysWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows";

export default async function seedDemoData({ container }: ExecArgs) {
  const logger: Logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const remoteLink: Link = container.resolve(ContainerRegistrationKeys.LINK);
  const fulfillmentModuleService: IFulfillmentModuleService = container.resolve(
    Modules.FULFILLMENT
  );
  const salesChannelModuleService: ISalesChannelModuleService =
    container.resolve(Modules.SALES_CHANNEL);
  const storeModuleService: IStoreModuleService = container.resolve(
    Modules.STORE
  );

  const countries = ["gb", "de", "dk", "se", "fr", "es", "it"];

  logger.info("Seeding store data...");
  const [store] = await storeModuleService.listStores();
  let defaultSalesChannel = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  });

  if (!defaultSalesChannel.length) {
    const { result: salesChannelResult } = await createSalesChannelsWorkflow(
      container
    ).run({
      input: {
        salesChannelsData: [
          {
            name: "Default Sales Channel",
          },
        ],
      },
    });
    defaultSalesChannel = salesChannelResult;
  }

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        supported_currencies: [
          {
            currency_code: "usd",
            is_default: true,
          },
          {
            currency_code: "eur",
          },
        ],
        default_sales_channel_id: defaultSalesChannel[0].id,
      },
    },
  });
  logger.info("Seeding region data...");
  const { result: regionResult } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: "North America",
          currency_code: "usd",
          countries: ["us", "ca"],
          payment_providers: ["pp_system_default"],
        },
        {
          name: "Europe",
          currency_code: "eur",
          countries,
          payment_providers: ["pp_system_default"],
        },
      ],
    },
  });
  const region = regionResult[0];
  logger.info("Finished seeding regions.");

  logger.info("Seeding tax regions...");
  await createTaxRegionsWorkflow(container).run({
    input: [...countries, "us", "ca"].map((country_code) => ({
      country_code,
    })),
  });
  logger.info("Finished seeding tax regions.");

  logger.info("Seeding stock location data...");
  const { result: stockLocationResult } = await createStockLocationsWorkflow(
    container
  ).run({
    input: {
      locations: [
        {
          name: "US Warehouse",
          address: {
            city: "Miami",
            country_code: "US",
            address_1: "",
          },
        },
      ],
    },
  });
  const stockLocation = stockLocationResult[0];

  await remoteLink.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_provider_id: "manual_manual",
    },
  });

  logger.info("Seeding fulfillment data...");
  const { result: shippingProfileResult } =
    await createShippingProfilesWorkflow(container).run({
      input: {
        data: [
          {
            name: "Default",
            type: "default",
          },
        ],
      },
    });
  const shippingProfile = shippingProfileResult[0];

  const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
    name: "US Warehouse delivery",
    type: "shipping",
    service_zones: [
      {
        name: "Domestic",
        geo_zones: [
          { country_code: "us", type: "country" },
          { country_code: "ca", type: "country" },
          { country_code: "gb", type: "country" },
          { country_code: "de", type: "country" },
          { country_code: "dk", type: "country" },
          { country_code: "se", type: "country" },
          { country_code: "fr", type: "country" },
          { country_code: "es", type: "country" },
          { country_code: "it", type: "country" },
        ],
      },
    ],
  });

  await remoteLink.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_set_id: fulfillmentSet.id,
    },
  });

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Standard Shipping",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Standard",
          description: "Ship in 3-5 business days.",
          code: "standard",
        },
        prices: [
          { currency_code: "usd", amount: 6 },
          { currency_code: "eur", amount: 5 },
          { region_id: region.id, amount: 5 },
        ],
        rules: [
          { attribute: "enabled_in_store", value: '"true"', operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
      },
      {
        name: "Express Shipping",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Express",
          description: "Ship in 1-2 business days.",
          code: "express",
        },
        prices: [
          { currency_code: "usd", amount: 13 },
          { currency_code: "eur", amount: 12 },
          { region_id: region.id, amount: 12 },
        ],
        rules: [
          { attribute: "enabled_in_store", value: '"true"', operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
      },
      {
        name: "Free Shipping",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Free Shipping",
          description: "Free shipping on orders over $50.",
          code: "free",
        },
        prices: [
          { currency_code: "usd", amount: 0 },
          { currency_code: "eur", amount: 0 },
          { region_id: region.id, amount: 0 },
        ],
        rules: [
          { attribute: "enabled_in_store", value: '"true"', operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
      },
    ],
  });
  logger.info("Finished seeding fulfillment data.");

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: stockLocation.id,
      add: [defaultSalesChannel[0].id],
    },
  });
  logger.info("Finished seeding stock location data.");

  logger.info("Seeding publishable API key data...");
  const { result: publishableApiKeyResult } = await createApiKeysWorkflow(
    container
  ).run({
    input: {
      api_keys: [
        {
          title: "Webshop",
          type: "publishable",
          created_by: "",
        },
      ],
    },
  });
  const publishableApiKey = publishableApiKeyResult[0];

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: publishableApiKey.id,
      add: [defaultSalesChannel[0].id],
    },
  });
  logger.info("Finished seeding publishable API key data.");

  logger.info("Seeding product categories...");

  const { result: categoryResult } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: [
        { name: "Disposables", is_active: true },
        { name: "Pod Kits", is_active: true },
        { name: "E-Liquids", is_active: true },
        { name: "Accessories", is_active: true },
      ],
    },
  });

  logger.info("Seeding product data...");

  // ── Disposables ──────────────────────────────────────────────────────────────

  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Elf Bar BC5000",
          category_ids: [
            categoryResult.find((c) => c.name === "Disposables")?.id ?? "",
          ],
          description:
            "The Elf Bar BC5000 delivers up to 5000 puffs with a rechargeable 650mAh battery and a 13ml pre-filled pod. Smooth draw, bold flavors, and mesh coil technology for an elevated disposable experience.",
          handle: "elf-bar-bc5000",
          weight: 60,
          status: ProductStatus.PUBLISHED,
          options: [
            {
              title: "Flavor",
              values: [
                "Watermelon Ice",
                "Blue Razz Ice",
                "Mango Peach Watermelon",
                "Strawberry Mango",
              ],
            },
          ],
          variants: [
            {
              title: "Watermelon Ice",
              sku: "ELFBAR-BC5000-WMI",
              options: { Flavor: "Watermelon Ice" },
              manage_inventory: false,
              prices: [
                { amount: 15, currency_code: "usd" },
                { amount: 14, currency_code: "eur" },
              ],
            },
            {
              title: "Blue Razz Ice",
              sku: "ELFBAR-BC5000-BRI",
              options: { Flavor: "Blue Razz Ice" },
              manage_inventory: false,
              prices: [
                { amount: 15, currency_code: "usd" },
                { amount: 14, currency_code: "eur" },
              ],
            },
            {
              title: "Mango Peach Watermelon",
              sku: "ELFBAR-BC5000-MPW",
              options: { Flavor: "Mango Peach Watermelon" },
              manage_inventory: false,
              prices: [
                { amount: 15, currency_code: "usd" },
                { amount: 14, currency_code: "eur" },
              ],
            },
            {
              title: "Strawberry Mango",
              sku: "ELFBAR-BC5000-STM",
              options: { Flavor: "Strawberry Mango" },
              manage_inventory: false,
              prices: [
                { amount: 15, currency_code: "usd" },
                { amount: 14, currency_code: "eur" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Lost Mary OS5000",
          category_ids: [
            categoryResult.find((c) => c.name === "Disposables")?.id ?? "",
          ],
          description:
            "The Lost Mary OS5000 features up to 5000 puffs, a 650mAh rechargeable battery, and 13ml of premium salt nic e-liquid. Compact design with a satisfying draw for on-the-go vaping.",
          handle: "lost-mary-os5000",
          weight: 55,
          status: ProductStatus.PUBLISHED,
          options: [
            {
              title: "Flavor",
              values: [
                "Pink Lemonade",
                "Grape Ice",
                "Peach Ice",
                "Black Cherry",
              ],
            },
          ],
          variants: [
            {
              title: "Pink Lemonade",
              sku: "LOSTMARY-OS5000-PL",
              options: { Flavor: "Pink Lemonade" },
              manage_inventory: false,
              prices: [
                { amount: 16, currency_code: "usd" },
                { amount: 15, currency_code: "eur" },
              ],
            },
            {
              title: "Grape Ice",
              sku: "LOSTMARY-OS5000-GI",
              options: { Flavor: "Grape Ice" },
              manage_inventory: false,
              prices: [
                { amount: 16, currency_code: "usd" },
                { amount: 15, currency_code: "eur" },
              ],
            },
            {
              title: "Peach Ice",
              sku: "LOSTMARY-OS5000-PI",
              options: { Flavor: "Peach Ice" },
              manage_inventory: false,
              prices: [
                { amount: 16, currency_code: "usd" },
                { amount: 15, currency_code: "eur" },
              ],
            },
            {
              title: "Black Cherry",
              sku: "LOSTMARY-OS5000-BC",
              options: { Flavor: "Black Cherry" },
              manage_inventory: false,
              prices: [
                { amount: 16, currency_code: "usd" },
                { amount: 15, currency_code: "eur" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // ── Pod Kits ─────────────────────────────────────────────────────────────────

  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "SMOK Nord 5 Pod Kit",
          category_ids: [
            categoryResult.find((c) => c.name === "Pod Kits")?.id ?? "",
          ],
          description:
            "The SMOK Nord 5 is a versatile pod kit with an 2000mAh built-in battery, adjustable wattage up to 80W, and compatibility with the full Nord coil range. Perfect for both mouth-to-lung and direct-lung vaping.",
          handle: "smok-nord-5",
          weight: 120,
          status: ProductStatus.PUBLISHED,
          options: [
            {
              title: "Color",
              values: ["Matte Black", "Fluid Blue", "Fluid Gray"],
            },
          ],
          variants: [
            {
              title: "Matte Black",
              sku: "SMOK-NORD5-BLK",
              options: { Color: "Matte Black" },
              manage_inventory: false,
              prices: [
                { amount: 35, currency_code: "usd" },
                { amount: 32, currency_code: "eur" },
              ],
            },
            {
              title: "Fluid Blue",
              sku: "SMOK-NORD5-BLU",
              options: { Color: "Fluid Blue" },
              manage_inventory: false,
              prices: [
                { amount: 35, currency_code: "usd" },
                { amount: 32, currency_code: "eur" },
              ],
            },
            {
              title: "Fluid Gray",
              sku: "SMOK-NORD5-GRY",
              options: { Color: "Fluid Gray" },
              manage_inventory: false,
              prices: [
                { amount: 35, currency_code: "usd" },
                { amount: 32, currency_code: "eur" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Voopoo Drag S Pro Pod Mod",
          category_ids: [
            categoryResult.find((c) => c.name === "Pod Kits")?.id ?? "",
          ],
          description:
            "The Voopoo Drag S Pro combines the power of a box mod with the convenience of a pod system. Featuring 80W max output, a 3000mAh battery, and Voopoo's GENE.TT chip for a smooth, consistent vape every time.",
          handle: "voopoo-drag-s-pro",
          weight: 140,
          status: ProductStatus.PUBLISHED,
          options: [
            {
              title: "Color",
              values: ["Classic", "Carbon Fiber", "Vintage"],
            },
          ],
          variants: [
            {
              title: "Classic",
              sku: "VOOPOO-DRAGS-PRO-CLS",
              options: { Color: "Classic" },
              manage_inventory: false,
              prices: [
                { amount: 50, currency_code: "usd" },
                { amount: 46, currency_code: "eur" },
              ],
            },
            {
              title: "Carbon Fiber",
              sku: "VOOPOO-DRAGS-PRO-CF",
              options: { Color: "Carbon Fiber" },
              manage_inventory: false,
              prices: [
                { amount: 50, currency_code: "usd" },
                { amount: 46, currency_code: "eur" },
              ],
            },
            {
              title: "Vintage",
              sku: "VOOPOO-DRAGS-PRO-VNT",
              options: { Color: "Vintage" },
              manage_inventory: false,
              prices: [
                { amount: 50, currency_code: "usd" },
                { amount: 46, currency_code: "eur" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // ── E-Liquids ─────────────────────────────────────────────────────────────────

  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Naked 100 Salt E-Liquid",
          category_ids: [
            categoryResult.find((c) => c.name === "E-Liquids")?.id ?? "",
          ],
          description:
            "Naked 100 Salt delivers premium nicotine salt e-liquids with natural flavor extracts. Smooth throat hit with rapid nicotine satisfaction. Available in 30ml bottles with 25mg and 50mg nicotine strengths.",
          handle: "naked-100-salt",
          weight: 80,
          status: ProductStatus.PUBLISHED,
          options: [
            {
              title: "Flavor",
              values: [
                "Lava Flow",
                "Really Berry",
                "Amazing Mango",
                "Hawaiian POG",
              ],
            },
            {
              title: "Nicotine",
              values: ["25mg", "50mg"],
            },
          ],
          variants: [
            {
              title: "Lava Flow / 25mg",
              sku: "NAKED100-LF-25",
              options: { Flavor: "Lava Flow", Nicotine: "25mg" },
              manage_inventory: false,
              prices: [
                { amount: 16, currency_code: "usd" },
                { amount: 15, currency_code: "eur" },
              ],
            },
            {
              title: "Lava Flow / 50mg",
              sku: "NAKED100-LF-50",
              options: { Flavor: "Lava Flow", Nicotine: "50mg" },
              manage_inventory: false,
              prices: [
                { amount: 16, currency_code: "usd" },
                { amount: 15, currency_code: "eur" },
              ],
            },
            {
              title: "Really Berry / 25mg",
              sku: "NAKED100-RB-25",
              options: { Flavor: "Really Berry", Nicotine: "25mg" },
              manage_inventory: false,
              prices: [
                { amount: 16, currency_code: "usd" },
                { amount: 15, currency_code: "eur" },
              ],
            },
            {
              title: "Really Berry / 50mg",
              sku: "NAKED100-RB-50",
              options: { Flavor: "Really Berry", Nicotine: "50mg" },
              manage_inventory: false,
              prices: [
                { amount: 16, currency_code: "usd" },
                { amount: 15, currency_code: "eur" },
              ],
            },
            {
              title: "Amazing Mango / 25mg",
              sku: "NAKED100-AM-25",
              options: { Flavor: "Amazing Mango", Nicotine: "25mg" },
              manage_inventory: false,
              prices: [
                { amount: 16, currency_code: "usd" },
                { amount: 15, currency_code: "eur" },
              ],
            },
            {
              title: "Amazing Mango / 50mg",
              sku: "NAKED100-AM-50",
              options: { Flavor: "Amazing Mango", Nicotine: "50mg" },
              manage_inventory: false,
              prices: [
                { amount: 16, currency_code: "usd" },
                { amount: 15, currency_code: "eur" },
              ],
            },
            {
              title: "Hawaiian POG / 25mg",
              sku: "NAKED100-HP-25",
              options: { Flavor: "Hawaiian POG", Nicotine: "25mg" },
              manage_inventory: false,
              prices: [
                { amount: 16, currency_code: "usd" },
                { amount: 15, currency_code: "eur" },
              ],
            },
            {
              title: "Hawaiian POG / 50mg",
              sku: "NAKED100-HP-50",
              options: { Flavor: "Hawaiian POG", Nicotine: "50mg" },
              manage_inventory: false,
              prices: [
                { amount: 16, currency_code: "usd" },
                { amount: 15, currency_code: "eur" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Freebase E-Liquid 60ml",
          category_ids: [
            categoryResult.find((c) => c.name === "E-Liquids")?.id ?? "",
          ],
          description:
            "Premium freebase nicotine e-liquid in a 60ml bottle with a 70VG/30PG blend. Perfect for sub-ohm tanks and RDAs. Available in 0mg, 3mg, and 6mg nicotine levels.",
          handle: "freebase-eliquid-60ml",
          weight: 120,
          status: ProductStatus.PUBLISHED,
          options: [
            {
              title: "Flavor",
              values: [
                "Strawberry Kiwi",
                "Blueberry Lemon",
                "Watermelon Mint",
              ],
            },
            {
              title: "Nicotine",
              values: ["0mg", "3mg", "6mg"],
            },
          ],
          variants: [
            {
              title: "Strawberry Kiwi / 0mg",
              sku: "FREEBASE-SK-0",
              options: { Flavor: "Strawberry Kiwi", Nicotine: "0mg" },
              manage_inventory: false,
              prices: [
                { amount: 13, currency_code: "usd" },
                { amount: 12, currency_code: "eur" },
              ],
            },
            {
              title: "Strawberry Kiwi / 3mg",
              sku: "FREEBASE-SK-3",
              options: { Flavor: "Strawberry Kiwi", Nicotine: "3mg" },
              manage_inventory: false,
              prices: [
                { amount: 13, currency_code: "usd" },
                { amount: 12, currency_code: "eur" },
              ],
            },
            {
              title: "Strawberry Kiwi / 6mg",
              sku: "FREEBASE-SK-6",
              options: { Flavor: "Strawberry Kiwi", Nicotine: "6mg" },
              manage_inventory: false,
              prices: [
                { amount: 13, currency_code: "usd" },
                { amount: 12, currency_code: "eur" },
              ],
            },
            {
              title: "Blueberry Lemon / 0mg",
              sku: "FREEBASE-BL-0",
              options: { Flavor: "Blueberry Lemon", Nicotine: "0mg" },
              manage_inventory: false,
              prices: [
                { amount: 13, currency_code: "usd" },
                { amount: 12, currency_code: "eur" },
              ],
            },
            {
              title: "Blueberry Lemon / 3mg",
              sku: "FREEBASE-BL-3",
              options: { Flavor: "Blueberry Lemon", Nicotine: "3mg" },
              manage_inventory: false,
              prices: [
                { amount: 13, currency_code: "usd" },
                { amount: 12, currency_code: "eur" },
              ],
            },
            {
              title: "Watermelon Mint / 6mg",
              sku: "FREEBASE-WM-6",
              options: { Flavor: "Watermelon Mint", Nicotine: "6mg" },
              manage_inventory: false,
              prices: [
                { amount: 13, currency_code: "usd" },
                { amount: 12, currency_code: "eur" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  // ── Accessories ───────────────────────────────────────────────────────────────

  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "USB-C Charging Cable",
          category_ids: [
            categoryResult.find((c) => c.name === "Accessories")?.id ?? "",
          ],
          description:
            "High-quality braided USB-C charging cable compatible with all rechargeable vape devices. Fast charging support, durable nylon braid, and 1m length. Available in black and white.",
          handle: "usb-c-charging-cable",
          weight: 40,
          status: ProductStatus.PUBLISHED,
          options: [
            {
              title: "Color",
              values: ["Black", "White"],
            },
          ],
          variants: [
            {
              title: "Black",
              sku: "CABLE-USBC-BLK",
              options: { Color: "Black" },
              manage_inventory: false,
              prices: [
                { amount: 8, currency_code: "usd" },
                { amount: 7, currency_code: "eur" },
              ],
            },
            {
              title: "White",
              sku: "CABLE-USBC-WHT",
              options: { Color: "White" },
              manage_inventory: false,
              prices: [
                { amount: 8, currency_code: "usd" },
                { amount: 7, currency_code: "eur" },
              ],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
        },
      ],
    },
  });

  logger.info("Finished seeding product data.");
}
