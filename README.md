# Askal DayZ JSON Editor

Editor visual para gerenciar configurações de itens do DayZ.

## Instalação

```bash
# Backend
pip install -r requirements.txt

# Frontend (desenvolvimento)
npm install
npm run dev
```

## Uso

1. Execute o servidor: `python server.py`
2. Acesse: `http://localhost:5000`

## Estrutura de Dados

Itens seguem o schema definido em `data/schemas/item-schema.json`.

### Herança de Parâmetros

- `restock` e `cost` podem ser definidos em `CategoryDefaults`
- Itens herdam valores da categoria se não especificados

## Contribuindo

1. Fork o projeto
2. Crie uma branch: `git checkout -b feature/nome`
3. Commit: `git commit -m 'Add: descrição'`
4. Push: `git push origin feature/nome`
5. Abra um Pull Request

## Testes

```bash
npm test           # Testes unitários
npm run validate   # Validar JSONs
```
