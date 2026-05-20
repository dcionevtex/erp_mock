import { randomUUID } from 'crypto';
import { appendCallLog, upsertOrder, getOrder } from '@/lib/marketplaceStore';
import type { MktScenario, MktSimulationRequest, MktOrderRequest } from '@/types/marketplace';

const DEFAULT_SLA = {
  id: 'Regular',
  deliveryChannel: 'delivery',
  name: 'Regular Shipping',
  deliveryIds: [
    {
      courierId: 'demo-carrier',
      courierName: 'Demo Carrier',
      dockId: 'demo-dock',
      quantity: 1,
      warehouseId: 'demo-warehouse',
    },
  ],
  shippingEstimate: '5bd',
  shippingEstimateDate: null,
  lockTTL: '1h',
  availableDeliveryWindows: [],
  deliveryWindow: null,
  price: 1000,
  listPrice: 1000,
  tax: 0,
  pickupStoreInfo: {
    isPickupStore: false,
    friendlyName: null,
    address: null,
    additionalInfo: null,
    dockId: null,
  },
  pickupPointId: null,
  pickupDistance: 0,
  polygonName: null,
  transitTime: '5bd',
};

export function handleSimulation(
  account: string,
  body: MktSimulationRequest,
  pathname: string,
  scenario: MktScenario,
  start: number,
) {
  const now = new Date().toISOString();
  const inputItems = body.items ?? [];

  const items = inputItems.map((item, index) => {
    const qty =
      scenario === 'unavailable' ? 0
      : scenario === 'partial' && index > 0 ? 0
      : item.quantity;
    return {
      id: item.id,
      requestIndex: index,
      quantity: qty,
      seller: account,
      merchantName: null,
      priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      price: 10000,
      listPrice: 12000,
      offerings: [],
      priceTags: [],
      measurementUnit: 'un',
      unitMultiplier: 1,
      attachmentOfferings: [],
    };
  });

  const logisticsInfo = inputItems.map((item, index) => {
    const available =
      scenario === 'available' || (scenario === 'partial' && index === 0);
    return {
      itemIndex: index,
      addressId: null,
      selectedSla: available ? 'Regular' : null,
      selectedDeliveryChannel: available ? 'delivery' : null,
      quantity: available ? item.quantity : 0,
      shipsTo: ['BRA'],
      slas: available ? [DEFAULT_SLA] : [],
      stockBalance: available ? 100 : 0,
      deliveryChannels: available ? [{ id: 'delivery' }] : [],
    };
  });

  const responseBody = {
    country: body.country ?? 'BRA',
    postalCode: body.postalCode ?? null,
    items,
    logisticsInfo,
    geoCoordinates: body.geoCoordinates ?? [],
  };

  appendCallLog(account, {
    timestamp: now,
    method: 'POST',
    path: pathname,
    account,
    endpoint: 'simulation',
    requestBody: body,
    responseBody,
    httpStatus: 200,
    durationMs: Date.now() - start,
  });

  return responseBody;
}

export function handleOrderPlacement(
  account: string,
  marketplaceOrderId: string,
  body: MktOrderRequest,
  pathname: string,
  start: number,
) {
  const now = new Date().toISOString();
  const sellerOrderId = `MKT-${randomUUID().slice(0, 8).toUpperCase()}`;

  upsertOrder({ orderId: marketplaceOrderId, sellerOrderId, account, status: 'placed', placedAt: now, requestBody: body });

  const responseBody = {
    marketplaceOrderId,
    orderId: sellerOrderId,
    followUpEmail: `seller@${account}.com`,
  };

  appendCallLog(account, {
    timestamp: now,
    method: 'POST',
    path: pathname,
    account,
    orderId: marketplaceOrderId,
    endpoint: 'placement',
    requestBody: body,
    responseBody,
    httpStatus: 200,
    durationMs: Date.now() - start,
  });

  return responseBody;
}

export function handleAuthorize(
  account: string,
  orderId: string,
  body: Record<string, unknown>,
  pathname: string,
  start: number,
) {
  const now = new Date().toISOString();
  const record = getOrder(account, orderId);
  if (record) upsertOrder({ ...record, status: 'authorized', authorizedAt: now });

  const responseBody = { orderId };

  appendCallLog(account, {
    timestamp: now,
    method: 'POST',
    path: pathname,
    account,
    orderId,
    endpoint: 'fulfill',
    requestBody: body,
    responseBody,
    httpStatus: 200,
    durationMs: Date.now() - start,
  });

  return responseBody;
}

export function handleCancellation(
  account: string,
  orderId: string,
  body: Record<string, unknown>,
  pathname: string,
  start: number,
) {
  const now = new Date().toISOString();
  const record = getOrder(account, orderId);
  if (record) upsertOrder({ ...record, status: 'cancelled', cancelledAt: now });

  const responseBody = { orderId, receipt: randomUUID(), date: now };

  appendCallLog(account, {
    timestamp: now,
    method: 'POST',
    path: pathname,
    account,
    orderId,
    endpoint: 'cancel',
    requestBody: body,
    responseBody,
    httpStatus: 200,
    durationMs: Date.now() - start,
  });

  return responseBody;
}
