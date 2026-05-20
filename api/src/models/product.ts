/**
 * @swagger
 * components:
 *   schemas:
 *     Product:
 *       type: object
 *       required:
 *         - productId
 *         - name
 *         - price
 *       properties:
 *         productId:
 *           type: integer
 *           description: The unique identifier for the product
 *         name:
 *           type: string
 *           description: The name of the product
 *         description:
 *           type: string
 *           description: Detailed description of the product
 *         price:
 *           type: number
 *           format: float
 *           description: The current price of the product
 *         supplierId:
 *           type: integer
 *           description: The ID of the supplier providing this product
 *         quantity:
 *           type: integer
 *           description: Current inventory quantity of the product
 *         reorder_threshold:
 *           type: integer
 *           description: Inventory threshold that triggers a low-stock alert when quantity drops below it
 *         discount:
 *           type: number
 *           format: float
 *           description: Discount percentage (if applicable) expressed as a decimal (e.g., 0.25 for 25%)
 */
export interface Product {
    productId: number;
    supplierId: number;
    name: string;
    description: string;
    price: number;
    sku: string;
    unit: string;
    imgName: string;
    quantity?: number;
    reorder_threshold?: number;
    discount?: number;
}
