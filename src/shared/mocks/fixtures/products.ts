export interface Product {
  id: string;
  name: string;
  price: string;
}

export const productsFixture: Product[] = [{ id: "1", name: "Robot A", price: "100" }];

export function getProducts(): Product[] {
  return productsFixture;
}
