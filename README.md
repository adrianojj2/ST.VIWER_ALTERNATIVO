# Transmissao Reservada - Viewer Alternativo

Frontend PWA de camera unica e identidade visual por local, integrado ao
SYSTEM VISION.

## Comportamento

- exibe o login sobre a pagina principal na primeira abertura;
- usa a mesma API, permissoes e stream protegido do SYSTEM VISION;
- exige que a conta autenticada tenha acesso a exatamente uma camera;
- abre essa camera automaticamente, sem sidebar, mosaico ou controles extras;
- identifica o local pelo equipamento da camera autorizada;
- aplica o nome e o logo configurados para esse local;
- mantem `TRANSMISSAO RESERVADA` e a frase inferior em todos os locais;
- deixa nome e logo vazios quando o local nao possui identidade visual;
- mantem a marca d'agua e a renovacao silenciosa da sessao de stream;
- guarda login apenas em `sessionStorage`: fechar a aba, janela ou app remove a
  sessao local; atualizar a mesma pagina preserva o acesso;
- preserva a troca obrigatoria da senha temporaria;
- pode ser instalado como PWA.

O titulo da aba e do aplicativo e `Transmissao Reservada System Vision`.

## Configuracao da identidade visual

O endereco `/config` e uma superficie administrativa exclusiva deste Viewer.
Ele nao adiciona menus ou componentes ao painel administrativo principal.

- autentica contas `SUPER_ADMIN` ja existentes na API principal;
- usa sessao administrativa separada da sessao do Viewer;
- lista os locais cadastrados no PostgreSQL principal;
- permite definir somente o nome exibido e o logo do local;
- permite substituir ou remover o logo;
- deixar o nome vazio restaura o titulo visual padrao.

O logo aceita JPG, PNG ou WebP de ate 5 MB. A API preserva a proporcao,
limita a imagem a `600 x 300`, sem ampliacao, converte para WebP e salva em
`/app/uploads/viewer-logos`. O PostgreSQL armazena somente o caminho relativo.

URLs personalizadas e uma entidade independente de empresa nao fazem parte
desta versao. Podem ser implementadas futuramente se uma mesma empresa passar
a compartilhar identidade entre varios locais.

## Arquitetura

Este repositorio publica somente o frontend. Nao publique banco, backend ou
stream-proxy separados.

```txt
Navegador -> /api no Nginx deste app -> https://api.systemtechlab.com.br
Navegador -> /uploads/viewer-logos no Nginx -> API principal
Navegador -> player autorizado -> https://stream.systemtechlab.com.br
```

Os proxies `/api` e `/uploads/viewer-logos` evitam alterar o CORS da API
principal e mantem os logos no mesmo dominio do Viewer.

O backend continua pertencendo exclusivamente ao repositorio `ST.PAGINA_ADM`.
As rotas de identidade ficam em `/api/locations/:id/viewer-brand` e
`/api/locations/:id/viewer-logo`, sempre protegidas por `SUPER_ADMIN`.

## Banco e ordem de publicacao

A identidade visual depende da migration oficial:

```txt
ST.PAGINA_ADM/backend/sql/022_add_location_viewer_branding.sql
```

Ela adiciona `viewer_brand_name` e `viewer_logo_path` em `locations`. Em
producao, seguir obrigatoriamente esta ordem:

1. identificar o PostgreSQL principal na VPS;
2. criar e validar o `pg_dump`;
3. aplicar a migration diretamente na VPS;
4. validar as novas colunas;
5. publicar a API principal;
6. publicar este frontend.

Nunca aplicar a migration pelo GitHub ou no PostgreSQL interno do Dokploy.

## Validacao estatica

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Nao use `localhost` ou `127.0.0.1` para validacao funcional.

## Dokploy

```txt
Repositorio: adrianojj2/ST.VIWER_ALTERNATIVO
Root Directory: .
Build Type: Dockerfile
Dockerfile: Dockerfile
Docker Context Path: .
Container Port: 80
```

Nao e necessario configurar `VITE_API_URL`. O Nginx do proprio frontend
encaminha `/api/*` para a API oficial.

Depois do deploy, validar no dominio real:

1. `/config` bloqueia contas que nao sejam `SUPER_ADMIN`;
2. `/config` lista os locais do banco principal;
3. nome e logo podem ser salvos, substituidos e removidos;
4. login com uma conta ativa que tenha exatamente uma camera permitida;
5. a camera abre automaticamente e usa a identidade do local correto;
6. local sem configuracao mostra `TRANSMISSAO RESERVADA`;
7. troca da senha temporaria continua obrigatoria;
8. renovacao silenciosa da transmissao continua funcionando;
9. fechamento e nova abertura exigem login novamente;
10. instalacao e abertura como PWA continuam funcionando.
