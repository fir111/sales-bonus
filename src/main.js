/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
   // @TODO: Расчет выручки от операции
    return purchase.sale_price * purchase.quantity * (1-purchase.discount / 100);
       // -_product.purchase_price*purchase.quantity;
}

function calculateSellerProfit(purchase_records) {
    return purchase_records.reduce((acc, record) => {
        const seller_id = record.seller_id;
        if (!acc[seller_id]) acc[seller_id] = { revenue: 0, discount: 0, profit: 0 };
        acc[seller_id].revenue += record.total_amount;
        acc[seller_id].discount += record.total_discount;
        acc[seller_id].profit += record.total_amount - record.total_discount;
        return acc;
    }, {})
}

function sortSellersByProfit(sellers) {
    const entries = Object.entries(sellers)
    entries.sort((a, b) => b[1].profit - a[1].profit);
    return entries;
}

function calculateBaseMetrics(records, calculateRevenue, products) {
    return records.reduce((acc, record) => {
        const seller_id = record.seller_id;
        const customer_id = record.customer_id;
        if (!acc.sellers[seller_id]) acc.sellers[seller_id] = {revenue: 0, profit: 0, items: [], customers: new Set()};
        if (!acc.customers[customer_id]) acc.customers[customer_id] = {revenue: 0, profit: 0, sellers: new Set()};
        record.items.forEach(item => {
            const product = products.find((product) => product.sku === item.sku);
            const profit = calculateRevenue(item, product);
            acc.sellers[seller_id].revenue += item.sale_price*item.quantity*(1-item.discount / 100);
            acc.sellers[seller_id].profit += profit;
            acc.sellers[seller_id].customers.add(customer_id);

            acc.customers[customer_id].revenue += item.sale_price*item.quantity*(1-item.discount / 100);
            acc.customers[customer_id].profit += profit;
            acc.customers[customer_id].sellers.add(seller_id);

            if (!acc.products[item.sku]) acc.products[item.sku] = {quantity: 0, revenue: 0};
            acc.products[item.sku].quantity += item.quantity;
            acc.products[item.sku].revenue = item.sale_price*item.quantity*(1-item.discount / 100);
        })

        return acc;
    }, {sellers:{}, customers:{}, products: {}});
}
/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
    // @TODO: Расчет бонуса от позиции в рейтинге
    let percent;
    if (index === 0) percent = 0.15;
    else if (index === 1) percent = 0.10;
    else if (index >= 2 && index <= total-2) percent = 0.05;
    else percent = 0;
    return seller.profit * percent;
}

function addedBonusesToSellers(sellers) {
    sellers = sortSellersByProfit(sellers);
    const total = sellers.length;
    for (let i = 0; i < total; i++) {
        sellers[i][1]['bonus'] = calculateBonusByProfit(i, total, sellers[i][1]);
    }
    return sellers;
}

function groupBy(array, keyFn) {
  return array.reduce((acc, item) => {
      const key = keyFn(item);
      if (!acc[key]) {
          acc[key] = [];
          acc[key].push(item);
          return acc;
      }
  }, {})
}
/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
    // @TODO: Проверка входных данных
    if (typeof data !== 'object' || data == null) {
        throw new Error('data must be not empty object'); }

    const checkData = (items) => {
        if ( !Array.isArray(items) || items.length === 0) {
            throw new Error(`${items} must be not array`);
        }
    }
    checkData(data.sellers);
    checkData(data.products);
    checkData(data.customers);
    checkData(data.purchase_records);

    // @TODO: Проверка наличия опций
    if ( options.calculateRevenue === undefined || options.calculateBonus === undefined ) {
        throw new Error(`calculateRevenue and calculateBonus must be defined`);
    }

    const { calculateRevenue, calculateBonus } = options;

    // @TODO: Подготовка промежуточных данных для сбора статистики
    const transformedSellers = data.sellers.map(seller => ({
            ...seller,
            name: `${seller.first_name} ${seller.last_name}`,
            revenue: 0,
            bonus: 0,
            profit: 0,
            sales_count: 0,
            products: [] }));

    const sellersMap = new Map();
    for (const seller of transformedSellers) {
        sellersMap.set(seller.id, seller);
    }

    // @TODO: Индексация продавцов и товаров для быстрого доступа
    const groupedBySeller = data.purchase_records.reduce((acc, receipt) => {
        const sellerId = receipt.seller_id;
        if (!acc[sellerId]) {
            acc[sellerId] = {
                name: sellersMap.get(sellerId).name,
                total_amount: 0,
                revenue: 0,
                total_discount: 0,
                profit: 0,
                sales_count: 0,
                receipts: []
            }
        }
        acc[sellerId].receipts.push(receipt);
        acc[sellerId].total_amount += receipt.total_amount;
        acc[sellerId].total_discount += receipt.total_discount;
        acc[sellerId].profit += receipt.total_amount;
        acc[sellerId].revenue += receipt.total_amount - receipt.total_discount;
        acc[sellerId].sales_count++;
        return acc;
    }, {});

    // @TODO: Расчет выручки и прибыли для каждого продавца
    Object.entries(groupedBySeller).forEach(([key, value]) => {
        const allItems = value.receipts.flatMap(receipt => receipt.items);
        const groupedBySku = allItems.reduce((acc, item) => {
            if (!acc[item.sku]) {
                acc[item.sku] = { ...item };
            } else {
                acc[item.sku].quantity += item.quantity;
            }
            return acc;
        }, {});
        value.grouped_items = Object.values(groupedBySku);
        value.grouped_items.sort((a, b) => b.quantity - a.quantity)
        value.top_products = value.grouped_items.slice(0, 10)
    });
    //console.log(groupedBySeller, Array.isArray(groupedBySeller));


    // @TODO: Назначение премий на основе ранжирования
    addedBonusesToSellers(groupedBySeller);
    // console.log(groupedBySeller, Array.isArray(groupedBySeller));


    // @TODO: Подготовка итоговой коллекции с нужными полями
    const result = Object.entries(groupedBySeller).map((entry) => {
        const [seller_id, seller] = entry;
        return {
            seller_id: seller_id,
            name: seller.name,
            revenue: seller.revenue,
            profit: seller.profit,
            sales_count: seller.sales_count,
            top_products: seller.top_products.map(product => {
                return {
                    sku: product.sku,
                    quantity: product.quantity,
                }
            }),
            bonus: seller.bonus,
        }
    });

    // @TODO: Сортировка продавцов по прибыли
    result.sort((a, b) => b.revenue - a.revenue) ;

    return result;

//     [{
//         seller_id: "seller_1", // Идентификатор продавца
//         name: "Alexey Petrov", // Имя и фамилия продавца
//         revenue: 123456, // Общая выручка с учётом скидок
//         profit: 12345, // Прибыль от продаж продавца
//         sales_count: 20, // Количество продаж
//         top_products: [{ // Топ-10 проданных товаров в штуках
//             sku: "SKU_001", // Артикул товара
//             quantity: 12: // Сколько продано
//         }],
//         bonus: 1234 // Итоговый бонус в рублях, не процент
// }]
}
