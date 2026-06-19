# Viewer Alternativo - Funeraria Bom Jesus

Frontend PWA de camera unica integrado ao SYSTEM VISION.

## Comportamento

- exibe o login sobre a pagina principal na primeira abertura;
- usa a mesma API, permissoes e stream protegido do SYSTEM VISION;
- exige que a conta autenticada tenha acesso a exatamente uma camera;
- abre essa camera automaticamente, sem sidebar, mosaico ou controles extras;
- mantem a marca d'agua e a renovacao silenciosa da sessao de stream;
- guarda login apenas em `sessionStorage`: fechar a aba, janela ou app remove a
  sessao local; atualizar a mesma pagina preserva o acesso;
- preserva a troca obrigatoria da senha temporaria;
- pode ser instalado como PWA.

## Arquitetura

Este repositorio publica somente o frontend. Nao publique banco, backend ou
stream-proxy separados.

```txt
Navegador -> /api no Nginx deste app -> https://api.systemtechlab.com.br
Navegador -> player autorizado -> https://stream.systemtechlab.com.br
```

O proxy `/api` evita alterar o CORS da API principal para cada novo dominio do
Viewer alternativo.

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

1. login com uma conta ativa que tenha exatamente uma camera permitida;
2. troca da senha temporaria no primeiro acesso;
3. abertura automatica da camera, sem botoes apos o login;
4. renovacao silenciosa da transmissao;
5. fechamento e nova abertura exigindo login novamente;
6. instalacao e abertura como PWA.
