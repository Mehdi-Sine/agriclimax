"""Independent real IFS arithmetic check, no production aggregate or RH functions."""
import argparse
import gzip
import hashlib
import json
import math
from collections import Counter
from pathlib import Path


def main() -> None:
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root',type=Path,required=True);p.add_argument('--output',type=Path,required=True)
    args=p.parse_args();cycle=json.loads((args.root/'cycle.json').read_text())
    raw=(args.root/'native.json.gz').read_bytes()
    assert hashlib.sha256(raw).hexdigest()==cycle['native_cache_sha256']
    fields=json.loads(gzip.decompress(raw))['fields']
    maximum=0.0;nulls=0;checks=0
    for row in cycle['rows']:
        end=row['lead_hours'];start=end-24
        steps=[s for s in range(start,end+1) if f'{s}:2t' in fields]
        weights=[w for w in cycle['weights'] if w['pra_id']==row['pra_id']]
        values=[]
        for w in weights:
            cell=w['cell_id'];temp=[fields[f'{s}:2t'][cell] for s in steps]
            variable=row['variable']
            if variable=='temperature_min':v=min(temp)-273.15
            elif variable=='temperature_max':v=max(temp)-273.15
            elif variable=='temperature':v=sum((temp[i]+temp[i+1])*(steps[i+1]-steps[i])/48 for i in range(len(steps)-1))-273.15
            elif variable=='precipitation':
                v=1000*(fields[f'{end}:tp'][cell]-fields[f'{start}:tp'][cell]);v=None if v<0 else v
            else:
                dew=[fields[f'{s}:2d'][cell] for s in steps]
                # Algebraically equivalent Magnus form, not the production helper.
                h=[100*math.exp(17.625*243.04*(d-t)/((243.04+d-273.15)*(243.04+t-273.15))) for t,d in zip(temp,dew,strict=True)]
                v=None if any(x<0 or x>100 for x in h) else sum((h[i]+h[i+1])*(steps[i+1]-steps[i])/48 for i in range(len(steps)-1))
            values.append((w['weight'],v))
        if any(v is None for _,v in values):
            assert row['value'] is None and row['status']!='available';nulls+=1
        else:
            numbers=[v for _,v in values]
            wanted=min(numbers) if row['variable']=='temperature_min' else max(numbers) if row['variable']=='temperature_max' else math.fsum(w*v for w,v in values)/math.fsum(w for w,v in values)
            difference=abs(wanted-row['value']);maximum=max(maximum,difference)
            assert difference<=1e-10,(row['pra_id'],row['valid_date'],row['variable'],difference)
        checks+=1
    report={'real_native_values':True,'production_aggregation_called':False,'rows_checked':checks,'nulls_checked':nulls,
            'max_absolute_difference':maximum,'tolerance':1e-10,'network_requests':0,
            'status_counts':dict(Counter(r['variable']+':'+r['status'] for r in cycle['rows'])),'native_sha256':cycle['native_cache_sha256']}
    args.output.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))


if __name__=='__main__':main()
