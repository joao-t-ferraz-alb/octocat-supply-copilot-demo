import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import productRouter, { inventoryEvents, LOW_STOCK_ALERT_EVENT, resetProducts } from './product';
import { products as seedProducts } from '../seedData';

let app: express.Express;

describe('Product API', () => {
    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/products', productRouter);
        resetProducts();
    });

    it('emits a low-stock alert when quantity drops below the reorder threshold', async () => {
        const lowStockListener = vi.fn();
        inventoryEvents.on(LOW_STOCK_ALERT_EVENT, lowStockListener);

        const quantityAtThreshold = {
            ...seedProducts[0],
            quantity: 10,
            reorder_threshold: 10
        };

        const thresholdResponse = await request(app).put('/products/1').send(quantityAtThreshold);
        expect(thresholdResponse.status).toBe(200);
        expect(lowStockListener).not.toHaveBeenCalled();

        const quantityBelowThreshold = {
            ...quantityAtThreshold,
            quantity: 9
        };

        const lowStockResponse = await request(app).put('/products/1').send(quantityBelowThreshold);
        expect(lowStockResponse.status).toBe(200);
        expect(lowStockListener).toHaveBeenCalledTimes(1);
        expect(lowStockListener).toHaveBeenCalledWith({
            productId: quantityBelowThreshold.productId,
            quantity: quantityBelowThreshold.quantity,
            reorder_threshold: quantityBelowThreshold.reorder_threshold
        });
    });
});
