#!/usr/bin/env bash
# Diz em que versão a API do estúdio está.
#
# Existe porque a API (Railway) e o site (Vercel) sobem separados: quando um
# avança e o outro não, a tela pede um dado que a API ainda não conhece e o
# sintoma aparece longe da causa. Este script responde "o deploy chegou?" sem
# precisar abrir o painel.
#
# Não altera nada — só consulta.
#
# Uso:  bash backend/scripts/diagnostico-api.sh SEU_EMAIL_ADMIN SUA_SENHA

API="${API:-https://life-company-production.up.railway.app}"
EMAIL="$1"
SENHA="$2"

if [ -z "$EMAIL" ] || [ -z "$SENHA" ]; then
  echo "uso: bash backend/scripts/diagnostico-api.sh email-do-admin senha"
  exit 1
fi

echo "API: $API"
echo

# ── A API está no ar? ────────────────────────────────────────────────
CODIGO=$(curl -s -m 20 -o /dev/null -w "%{http_code}" "$API/auth/me")
if [ "$CODIGO" = "000" ]; then
  echo "❌ A API não respondeu. Ou está fora do ar, ou o endereço mudou."
  exit 1
fi
echo "✅ A API está no ar (respondeu $CODIGO em /auth/me)"

# ── Login ────────────────────────────────────────────────────────────
RESP=$(curl -s -m 20 -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"senha\":\"$SENHA\"}")
TOKEN=$(printf '%s' "$RESP" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')

if [ -z "$TOKEN" ]; then
  echo "❌ Não consegui entrar. Resposta da API:"
  printf '   %s\n' "$RESP"
  exit 1
fi
echo "✅ Login do admin funcionou"
echo
echo "── O que já está na API ─────────────────────────────────────────"

# ── Marcador 1: tela de professores ──────────────────────────────────
C=$(curl -s -m 20 -o /dev/null -w "%{http_code}" "$API/usuarios/professores" -H "Authorization: Bearer $TOKEN")
if [ "$C" = "200" ]; then echo "✅ lista de professores"
else echo "❌ lista de professores (respondeu $C) — a API está ANTES desse recurso"; fi

# ── Marcador 2: valor da mensalidade ─────────────────────────────────
R=$(curl -s -m 20 "$API/financeiro/resumo" -H "Authorization: Bearer $TOKEN")
case "$R" in
  *'"previsto"'*) echo "✅ valor da mensalidade no financeiro" ;;
  *)              echo "❌ valor da mensalidade — a API está ANTES desse recurso" ;;
esac

echo
echo "── Conclusão ────────────────────────────────────────────────────"
case "$R" in
  *'"previsto"'*) echo "A API está atualizada. Se a tela ainda falhar, é cache do navegador:"
                  echo "recarregue com Ctrl+Shift+R (ou Cmd+Shift+R no Mac)." ;;
  *)              echo "A API está DESATUALIZADA — o último deploy não chegou nela."
                  echo "Abra a Railway → serviço da API → aba Deployments e veja o"
                  echo "estado do último deploy. Se estiver vermelho, copie o log." ;;
esac
