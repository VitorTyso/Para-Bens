# Para Bens — Gestão de Condomínios

Aplicação web estática com cadastro, consulta, importação Excel e cobranças.

Dados salvos somente no navegador (IndexedDB); sem banco compartilhado ou autenticação de funcionários nesta versão. Não inclui dados pessoais pré-carregados. Faça backups antes de limpar o navegador. Importações do endereço antigo precisam ser refeitas no novo endereço.

Deploy na Vercel: framework Other, sem build, diretório de saída raiz.

## Pagamentos e documentos fiscais

Em Cobrança, importe um CSV com cabeçalho `competencia;unidade;valor;data`. Arquivos CNAB precisam de conversão. Em Condomínio → Documentos, vincule XML e DANFSe às unidades. A emissão oficial é feita externamente.
