content = open('miniprogram/pages/member/order.js', 'r', encoding='utf-8').read()  
content = content.replace(\" monthlyPrice: 19.90 "\, \monthlyPrice:" 29.90 "\)  
open('miniprogram/pages/member/order.js', 'w', encoding='utf-8').write(content)  
print('OK')  
