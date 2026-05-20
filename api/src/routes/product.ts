/**
 * @swagger
 * tags:
 *   name: Products
 *   description: API endpoints for managing products
 */

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Returns all products
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: List of all products
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Product'
 *   post:
 *     summary: Create a new product
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Product'
 *     responses:
 *       201:
 *         description: Product created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 * 
 * /api/products/{id}:
 *   get:
 *     summary: Get a product by ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       404:
 *         description: Product not found
 *   put:
 *     summary: Update a product
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Product'
 *     responses:
 *       200:
 *         description: Product updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       404:
 *         description: Product not found
 *   delete:
 *     summary: Delete a product
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product ID
 *     responses:
 *       204:
 *         description: Product deleted successfully
 *       404:
 *         description: Product not found
 */

import express from 'express';
import { EventEmitter } from 'events';
import { Product } from '../models/product';
import { products as seedProducts } from '../seedData';

const router = express.Router();

let products: Product[] = [...seedProducts];

export const LOW_STOCK_ALERT_EVENT = 'low-stock-alert';
export const inventoryEvents = new EventEmitter();

export const resetProducts = () => {
  products = [...seedProducts];
  inventoryEvents.removeAllListeners();
};

const shouldEmitLowStockAlert = (previousProduct: Product, updatedProduct: Product) => {
  if (
    typeof previousProduct.quantity !== 'number' ||
    typeof previousProduct.reorder_threshold !== 'number' ||
    typeof updatedProduct.quantity !== 'number' ||
    typeof updatedProduct.reorder_threshold !== 'number'
  ) {
    return false;
  }

  return (
    previousProduct.quantity >= previousProduct.reorder_threshold &&
    updatedProduct.quantity < updatedProduct.reorder_threshold
  );
};

const buildUpdatedProduct = (existingProduct: Product, updates: Partial<Product>): Product | null => {
  if (
    typeof updates.supplierId !== 'number' ||
    typeof updates.name !== 'string' ||
    typeof updates.description !== 'string' ||
    typeof updates.price !== 'number' ||
    typeof updates.sku !== 'string' ||
    typeof updates.unit !== 'string' ||
    typeof updates.imgName !== 'string'
  ) {
    return null;
  }

  if (
    (Object.prototype.hasOwnProperty.call(updates, 'quantity') && typeof updates.quantity !== 'number') ||
    (Object.prototype.hasOwnProperty.call(updates, 'reorder_threshold') &&
      typeof updates.reorder_threshold !== 'number') ||
    (Object.prototype.hasOwnProperty.call(updates, 'discount') && typeof updates.discount !== 'number')
  ) {
    return null;
  }

  return {
    ...existingProduct,
    supplierId: updates.supplierId,
    name: updates.name,
    description: updates.description,
    price: updates.price,
    sku: updates.sku,
    unit: updates.unit,
    imgName: updates.imgName,
    quantity: Object.prototype.hasOwnProperty.call(updates, 'quantity')
      ? updates.quantity
      : existingProduct.quantity,
    reorder_threshold: Object.prototype.hasOwnProperty.call(updates, 'reorder_threshold')
      ? updates.reorder_threshold
      : existingProduct.reorder_threshold,
    discount: Object.prototype.hasOwnProperty.call(updates, 'discount')
      ? updates.discount
      : existingProduct.discount,
    productId: existingProduct.productId
  };
};

// Create a new product
router.post('/', (req, res) => {
  const newProduct: Product = req.body;
  products.push(newProduct);
  res.status(201).json(newProduct);
});

// Get all products
router.get('/', (req, res) => {
  res.json(products);
});

// Get a product by ID
router.get('/:id', (req, res) => {
  const product = products.find(p => p.productId === parseInt(req.params.id));
  if (product) {
    res.json(product);
  } else {
    res.status(404).send('Product not found');
  }
});

// Update a product by ID
router.put('/:id', (req, res) => {
  const index = products.findIndex(p => p.productId === parseInt(req.params.id));
  if (index !== -1) {
    const previousProduct = products[index];
    const updatedProduct = buildUpdatedProduct(previousProduct, req.body);

    if (!updatedProduct) {
      res.status(400).send('Invalid product payload');
      return;
    }

    products[index] = updatedProduct;

    if (shouldEmitLowStockAlert(previousProduct, updatedProduct)) {
      inventoryEvents.emit(LOW_STOCK_ALERT_EVENT, {
        productId: updatedProduct.productId,
        quantity: updatedProduct.quantity,
        reorder_threshold: updatedProduct.reorder_threshold
      });
    }

    res.json(products[index]);
  } else {
    res.status(404).send('Product not found');
  }
});

// Delete a product by ID
router.delete('/:id', (req, res) => {
  const index = products.findIndex(p => p.productId === parseInt(req.params.id));
  if (index !== -1) {
    products.splice(index, 1);
    res.status(204).send();
  } else {
    res.status(404).send('Product not found');
  }
});

export default router;
