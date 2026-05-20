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

    it('does not emit another low-stock alert when quantity stays below the threshold', async () => {
        const lowStockListener = vi.fn();
        inventoryEvents.on(LOW_STOCK_ALERT_EVENT, lowStockListener);

        const belowThresholdProduct = {
            ...seedProducts[0],
            quantity: 9,
            reorder_threshold: 10
        };

        const initialResponse = await request(app).put('/products/1').send(belowThresholdProduct);
        expect(initialResponse.status).toBe(200);
        expect(lowStockListener).not.toHaveBeenCalled();

        const followUpResponse = await request(app).put('/products/1').send({ quantity: 5 });
        expect(followUpResponse.status).toBe(200);
        expect(lowStockListener).not.toHaveBeenCalled();
    });

    it('does not emit a low-stock alert when only the threshold changes while quantity is already below it', async () => {
        const lowStockListener = vi.fn();
        inventoryEvents.on(LOW_STOCK_ALERT_EVENT, lowStockListener);

        const belowThresholdProduct = {
            ...seedProducts[0],
            quantity: 5,
            reorder_threshold: 10
        };

        const initialResponse = await request(app).put('/products/1').send(belowThresholdProduct);
        expect(initialResponse.status).toBe(200);
        expect(lowStockListener).not.toHaveBeenCalled();

        const thresholdChangeResponse = await request(app)
            .put('/products/1')
            .send({ reorder_threshold: 15 });

        expect(thresholdChangeResponse.status).toBe(200);
        expect(thresholdChangeResponse.body.quantity).toBe(5);
        expect(thresholdChangeResponse.body.reorder_threshold).toBe(15);
        expect(lowStockListener).not.toHaveBeenCalled();
    });

    it('rejects invalid and unknown product update fields', async () => {
        const invalidTypeResponse = await request(app).put('/products/1').send({ price: 'string' });
        expect(invalidTypeResponse.status).toBe(400);

        const unknownFieldResponse = await request(app)
            .put('/products/1')
            .send({ name: 'Renamed product', productId: 999 });
        expect(unknownFieldResponse.status).toBe(400);
    });

    it('preserves existing fields when applying a partial product update', async () => {
        const response = await request(app).put('/products/1').send({ name: 'Updated product name' });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            ...seedProducts[0],
            name: 'Updated product name'
        });
    });
});
