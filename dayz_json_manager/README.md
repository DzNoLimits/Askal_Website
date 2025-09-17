DayZ JSON Manager - Prototype (Expanded)

Gerenciador web simples para editar arquivos JSON do servidor DayZ (`Weapons.json` e `Clothings.json`).

Requisitos
- Python 3.9+
- Instalar dependências: `pip install -r dayz_json_manager/requirements.txt`

Executar (PowerShell):

```powershell
python -m pip install -r d:/Dayz/Askal_Website/dayz_json_manager/requirements.txt
python d:/Dayz/Askal_Website/dayz_json_manager/main.py
```

Acesse: http://127.0.0.1:8000/

Endpoints (Flask)
- GET  `/api/weapons`   -> retorna JSON de armas
- PUT  `/api/weapons`   -> salva JSON de armas (body: `{ "data": { ... } }`)
- GET  `/api/clothings` -> retorna JSON de roupas
- PUT  `/api/clothings` -> salva JSON de roupas

Interface
- Abas: Weapons / Clothings
- Busca por classname + filtro por tier
- Edição inline de: `tier`, `value`, renomear classname
- Weapons: edição de arrays `ammo_types`, `magazines`, `variants`, `flags`; objeto `attachments` (slots + listas)
- Clothings: edição de arrays `variants`, `attachments`, `flags`
- Adicionar / remover: itens, categorias, valores em arrays, slots de attachments
- Salvar apenas aba ativa ou ambos
- Marca estado sujo (internamente) para cada dataset

Limitações atuais
- Sem drag & drop ainda
- Sem undo/redo
- Sem validação rígida de schema (entrada mínima: possuir `Categories`)
- Sem import/export via upload/download (apenas leitura/gravação local)

Próximos passos sugeridos
1. Drag & drop para mover item entre categorias (HTML5 + atualizar dataset local)
2. Undo/Redo: manter stack de snapshots (limitar tamanho) e botões
3. Import/Export: adicionar input file e botão de download (`Blob`)
4. Validação de integridade (ex: valores numéricos, campos requeridos)
5. Diff visual antes de salvar (comparar com cópia carregada)
6. Autenticação (token simples) para uso remoto
7. Integração futura com Discord bot (webhook ou comandos)

Estrutura
```
dayz_json_manager/
	main.py             # Flask server
	static/index.html   # Frontend (Tailwind via CDN)
	requirements.txt
```

Licença / Uso
Uso interno para administração do servidor DayZ.
