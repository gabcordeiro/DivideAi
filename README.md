# 💸 Divide Aí

App para **dividir contas de viagens e festas antecipadamente**. Os participantes entram no
evento, veem os itens que serão comprados, **votam no tesoureiro** (quem guarda o dinheiro),
recebem a **chave Pix** dele e acompanham, **em tempo real**, quem já pagou e quem ainda deve.

Stack: **React + Vite + TypeScript + Tailwind CSS + lucide-react** no front, **Supabase**
(Postgres, Auth e Realtime) no back.

---

## 📁 Estrutura de pastas

```
DivideAi/
├─ public/                     # assets estáticos
├─ src/
│  ├─ components/
│  │  ├─ ui/                   # primitivos de UI reutilizáveis
│  │  │  ├─ Button.tsx
│  │  │  ├─ Input.tsx
│  │  │  ├─ Card.tsx
│  │  │  ├─ Spinner.tsx
│  │  │  └─ StatusBadge.tsx
│  │  ├─ layout/
│  │  │  └─ Header.tsx
│  │  └─ ProtectedRoute.tsx    # guarda de rotas autenticadas
│  ├─ context/
│  │  └─ AuthContext.tsx       # sessão Supabase Auth (login/cadastro/logout)
│  ├─ lib/
│  │  ├─ supabaseClient.ts     # cliente Supabase tipado (singleton)
│  │  └─ format.ts             # helpers (moeda, divisão)
│  ├─ pages/
│  │  ├─ Login.tsx
│  │  ├─ Signup.tsx
│  │  ├─ Dashboard.tsx         # lista de eventos + "Criar evento"
│  │  ├─ CreateEvent.tsx       # nome + itens + total calculado
│  │  └─ EventDetails.tsx      # ⭐ Realtime + votação + Pix + pagamentos
│  ├─ types/
│  │  └─ database.types.ts     # tipos do banco (espelham o schema.sql)
│  ├─ App.tsx                  # rotas (react-router-dom)
│  ├─ main.tsx                 # bootstrap (Router + AuthProvider)
│  ├─ index.css                # Tailwind + estilos base
│  └─ vite-env.d.ts            # tipos das env vars VITE_*
├─ supabase/
│  └─ schema.sql               # ⭐ rode no SQL Editor do Supabase
├─ .env.example
├─ index.html
├─ package.json
├─ tailwind.config.js
├─ tsconfig.json
└─ vite.config.ts
```

---

## 🚀 Como rodar

### 1. Pré-requisitos
- Node.js 18+ e npm
- Uma conta no [Supabase](https://supabase.com)

### 2. Instale as dependências
```bash
npm install
```

### 3. Configure o Supabase
1. Crie um projeto em <https://supabase.com/dashboard>.
2. Vá em **SQL Editor**, cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**.
   - Isso cria as tabelas, RLS, triggers e ativa o Realtime.
3. (Opcional, mas recomendado para testar rápido) Em **Authentication > Providers > Email**,
   desative *"Confirm email"* para conseguir logar logo após o cadastro.
4. Em **Project Settings > API**, copie a **Project URL** e a **anon public key**.

### 4. Variáveis de ambiente
```bash
cp .env.example .env
```
Edite o `.env`:
```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-public-key
```
> ⚠️ No Vite, **só** variáveis com prefixo `VITE_` chegam ao navegador. O arquivo `.env`
> está no `.gitignore` — **nunca** suba chaves para o repositório. A *anon key* é pública por
> design (o que protege os dados é o **RLS**), mas a *service_role key* **nunca** deve ir ao front.

### 5. Suba o app
```bash
npm run dev
```
Abra <http://localhost:5173>.

---

## 🔁 Fluxo do app

1. **Cadastro/Login** (Supabase Auth, e-mail + senha).
2. **Dashboard** — lista seus eventos e o botão *Criar novo evento*.
3. **Criar evento** — nome + lista de itens (produto e valor). O total é calculado na hora.
4. **Votação** — cada participante vota em quem será o **tesoureiro**. O criador encerra a votação.
5. **Coleta (Realtime)** — mostra o valor por pessoa, a **chave Pix** do tesoureiro, o botão
   *Já paguei* e, para o tesoureiro, *Confirmar recebimento*. Todos os status atualizam ao vivo.

> Para convidar alguém: compartilhe a URL do evento (`/events/:id`). Ao abrir, a pessoa vê a
> tela *Entrar no evento* e passa a participar.

---

## 🐙 Inicializar o repositório no GitHub

O projeto já está versionado localmente. Para publicar no GitHub:

### Opção A — com a CLI do GitHub (`gh`)
```bash
git add .
git commit -m "feat: scaffold inicial do DivideAi"
gh repo create DivideAi --public --source=. --remote=origin --push
```

### Opção B — manual
1. Crie um repositório vazio em <https://github.com/new> (sem README/.gitignore).
2. No terminal, na raiz do projeto:
```bash
git add .
git commit -m "feat: scaffold inicial do DivideAi"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/DivideAi.git
git push -u origin main
```

### Variáveis de ambiente no deploy (Vercel / Netlify)
- Conecte o repositório na plataforma.
- Em **Environment Variables**, adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- Build command: `npm run build` · Output: `dist`.

---

## 🔒 Segurança (RLS)

- Todas as tabelas têm **Row Level Security** habilitado.
- Funções `is_event_participant()` e `is_event_treasurer()` são `SECURITY DEFINER` para evitar
  **recursão infinita** nas policies de `participants`.
- O front só usa a **anon key**; o acesso real aos dados é decidido pelas policies no banco.

## 📜 Scripts
| Comando | O que faz |
|---|---|
| `npm run dev` | sobe o servidor de desenvolvimento |
| `npm run build` | type-check + build de produção |
| `npm run preview` | serve o build localmente |
| `npm run lint` | checagem de tipos (tsc) |
