export const PRODUCTIONS=[
 {id:'wheat',label:'Blé tendre',groups:[1],phenomena:['heat','frost','rain','dry'],reference:'https://www.wcrp-climate.org/etccdi',limitation:'Aucun stade ou sensibilité variétale inféré.'},
 {id:'maize',label:'Maïs',groups:[2],phenomena:['heat','frost','rain','dry'],reference:'https://www.fao.org/4/i2800e/i2800e00.htm',limitation:'Maïs grain et ensilage regroupés dans le RPG ; irrigation, variété et floraison inconnues.'},
 {id:'vine',label:'Vigne',groups:[21],phenomena:['heat','frost','rain','dry'],reference:'https://www.fao.org/4/i2800e/i2800e00.htm',limitation:'Stade, cépage et conduite inconnus ; aucune règle de gel de bourgeon.'},
 {id:'orchard',label:'Arboriculture · vergers',groups:[20],phenomena:['heat','frost','rain','dry'],reference:'https://www.fao.org/4/i2800e/i2800e00.htm',limitation:'Vergers déclarés uniquement ; fruits à coque et oliviers exclus de ce groupe. Espèce et floraison inconnues.'},
 {id:'grassland',label:'Prairies',groups:[18,19],phenomena:['heat','frost','rain','dry'],reference:'https://www.fao.org/4/i2800e/i2800e00.htm',limitation:'Prairies permanentes et temporaires ; estives et landes exclues. Biomasse et humidité du sol inconnues.'},
] as const;
