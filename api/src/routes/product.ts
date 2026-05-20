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

const ALLOWED_PRODUCT_UPDATE_FIELDS = [
  'productId',
  'supplierId',
  'name',
  'description',
  'price',
  'sku',
  'unit',
  'imgName',
  'quantity',
  'reorder_threshold',
  'discount'
] as const;

export const resetProducts = () => {
  products = [...seedProducts];
  inventoryEvents.removeAllListeners();
};

const hasOwnProperty = <Key extends keyof Product>(value: Partial<Product>, key: Key) =>
  Object.prototype.hasOwnProperty.call(value, key);

const shouldEmitLowStockAlert = (previousProduct: Product, updatedProduct: Product) => {
  if (
    typeof previousProduct.quantity !== 'number' ||
    typeof previousProduct.reorder_threshold !== 'number' ||
    typeof updatedProduct.quantity !== 'number' ||
    typeof updatedProduct.reorder_threshold !== 'number'
  ) {
    return false;
  }

  // Threshold-only edits should not emit alerts; only a quantity crossing below the
  // previously persisted threshold should do so.
  return (
    previousProduct.quantity >= previousProduct.reorder_threshold &&
    updatedProduct.quantity < previousProduct.reorder_threshold
  );
};

const buildUpdatedProduct = (existingProduct: Product, updates: Partial<Product>): Product | null => {
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    return null;
  }

  const unknownFields = Object.keys(updates).filter(
    key => !ALLOWED_PRODUCT_UPDATE_FIELDS.includes(key as (typeof ALLOWED_PRODUCT_UPDATE_FIELDS)[number])
  );

  if (unknownFields.length > 0) {
    return null;
  }

  if (
    (hasOwnProperty(updates, 'productId') && typeof updates.productId !== 'number') ||
    (hasOwnProperty(updates, 'supplierId') && typeof updates.supplierId !== 'number') ||
    (hasOwnProperty(updates, 'name') && typeof updates.name !== 'string') ||
    (hasOwnProperty(updates, 'description') && typeof updates.description !== 'string') ||
    (hasOwnProperty(updates, 'price') && typeof updates.price !== 'number') ||
    (hasOwnProperty(updates, 'sku') && typeof updates.sku !== 'string') ||
    (hasOwnProperty(updates, 'unit') && typeof updates.unit !== 'string') ||
    (hasOwnProperty(updates, 'imgName') && typeof updates.imgName !== 'string')
  ) {
    return null;
  }

  if (
    (hasOwnProperty(updates, 'quantity') && typeof updates.quantity !== 'number') ||
    (hasOwnProperty(updates, 'reorder_threshold') && typeof updates.reorder_threshold !== 'number') ||
    (hasOwnProperty(updates, 'discount') && typeof updates.discount !== 'number')
  ) {
    return null;
  }

  if (hasOwnProperty(updates, 'productId') && updates.productId !== existingProduct.productId) {
    return null;
  }

  return {
    ...existingProduct,
    ...updates,
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
