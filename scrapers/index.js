import { SHOPS } from '../core/shops.js';
import * as woo from './woo.js';
import * as shopify from './shopify.js';
import * as sfcc from './sfcc.js';
import * as shopware from './shopware.js';
import * as mystore from './mystore.js';
import * as magento from './magento.js';
import * as xxl from './xxl.js';
import * as life from './life.js';

export const PLATFORMS = { woo, shopify, sfcc, shopware, mystore, magento, xxl, life };

export function shopWithId(id) {
  return { id, ...SHOPS[id] };
}

export function scraperFor(id) {
  return PLATFORMS[SHOPS[id].platform];
}

export { scanPromos } from './promos.js';
