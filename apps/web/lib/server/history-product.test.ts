import {it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {packHistoryProduct,unpackHistoryProduct} from './history-product';
it('preserves every proof and scalar while sharing references',()=>{
 const proof={source:'era5-land',dates:['2026-10-01','2026-10-02'],flags:['exploratory'],value:null};
 const raw={a:{value:1.234567890123456,proof},b:{value:0,proof},c:{value:false,proof}};
 const product=packHistoryProduct(raw);
 expect(unpackHistoryProduct(product)).toEqual(raw);
 expect(product.nodes.filter(n=>n[0]===0&&n[1]==='era5-land')).toHaveLength(1);
 expect(()=>unpackHistoryProduct({version:'climate-history-product-1',root:0,nodes:[[2,[0]]]})).toThrow('PRODUCT_REFERENCE');
 expect(()=>packHistoryProduct({value:Infinity})).toThrow('PRODUCT_VALUE');
});
