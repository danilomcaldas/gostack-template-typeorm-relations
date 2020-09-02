import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) { }

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerExists = await this.customersRepository.findById(customer_id);

    if (!customerExists) {
      throw new AppError('Could not find any customer with give id');
    };

    const productExists = await this.productsRepository.findAllById(products);

    if (!productExists) {
      throw new AppError('Could not find product with give ids');
    };

    const productExistsIds = productExists.map(product => product.id);

    const checkProductsInexistent = products.filter(product => !productExistsIds.includes(product.id));

    if (checkProductsInexistent.length) {
      throw new AppError(`Could not find product ${checkProductsInexistent[0].id}`);
    };

    const findProductWithNoQuantityAvailable = products.filter(
      product => productExists.filter(p => p.id === product.id)[0].quantity < product.quantity,
    );

    if (findProductWithNoQuantityAvailable.length) {
      throw new AppError(`The quantity ${findProductWithNoQuantityAvailable[0].quantity} is not available for ${findProductWithNoQuantityAvailable[0].id}`)
    };

    const serializedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: productExists.filter(p => p.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: customerExists,
      products: serializedProducts,

    });

    const { order_products } = order;

    const orderProductsQuantity = order_products.map(product => ({
      id: product.product_id,
      quantity: productExists.filter(p => p.id === product.product_id)[0].quantity - product.quantity,
    }));


    await this.productsRepository.updateQuantity(orderProductsQuantity);

    return order;


  }
}

export default CreateOrderService;
