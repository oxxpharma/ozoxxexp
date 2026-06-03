"""Default email templates seeded into DB on startup."""

DEFAULT_TEMPLATES = [
    {
        "template_id": "tpl_password_reset",
        "name": "Reset de senha",
        "subject": "Redefina sua senha — Ozoxx Experience",
        "description": "Enviado quando usuário solicita reset",
        "html": """
<div style="font-family:Arial,sans-serif;background:#070b1e;padding:40px;color:#fff">
  <table width="560" align="center" style="background:#101638;border-radius:16px;padding:32px;color:#fff">
    <tr><td>
      <h1 style="color:#28b9fc;margin:0 0 8px 0">Redefina sua senha</h1>
      <p style="color:#a0a8c0">Olá {{name}}, recebemos um pedido para redefinir sua senha.</p>
      <p style="text-align:center;margin:32px 0">
        <a href="{{reset_link}}" style="background:#28b9fc;color:#070b1e;text-decoration:none;padding:14px 32px;border-radius:999px;font-weight:bold;display:inline-block">Redefinir senha</a>
      </p>
      <p style="color:#a0a8c0;font-size:12px">Se você não pediu, ignore este e-mail. O link expira em 1 hora.</p>
    </td></tr>
  </table>
</div>
""",
    },
    {
        "template_id": "tpl_welcome",
        "name": "Boas-vindas",
        "subject": "Bem-vindo ao Ozoxx Experience",
        "description": "Após cadastro",
        "html": """
<div style="font-family:Arial,sans-serif;background:#070b1e;padding:40px;color:#fff">
  <table width="560" align="center" style="background:#101638;border-radius:16px;padding:32px;color:#fff">
    <tr><td>
      <h1 style="color:#28b9fc">Bem-vindo, {{name}}!</h1>
      <p style="color:#a0a8c0">Sua jornada Ozoxx começa agora. Acompanhe sua conta no link abaixo.</p>
      <p><a href="{{site_url}}/dashboard" style="color:#28b9fc">{{site_url}}/dashboard</a></p>
    </td></tr>
  </table>
</div>
""",
    },
    {
        "template_id": "tpl_leader_goal_reached",
        "name": "Líder atingiu a meta",
        "subject": "Parabéns! Sua meta foi atingida 🎉",
        "description": "Quando líder bate meta de vendas",
        "html": """
<div style="font-family:Arial,sans-serif;background:#070b1e;padding:40px;color:#fff">
  <table width="560" align="center" style="background:#101638;border-radius:16px;padding:32px;color:#fff">
    <tr><td>
      <h1 style="color:#28b9fc">Parabéns, {{name}}!</h1>
      <p style="color:#a0a8c0">Você bateu sua meta de {{target}} vendas e conquistou seu ingresso oficial Ozoxx Experience.</p>
      <p>Sua credencial foi emitida automaticamente. Acesse o painel para visualizá-la.</p>
    </td></tr>
  </table>
</div>
""",
    },
    {
        "template_id": "tpl_payment_failed",
        "name": "Pagamento não concluído",
        "subject": "Não conseguimos confirmar seu pagamento",
        "description": "Quando o pagamento falha",
        "html": """
<div style="font-family:Arial,sans-serif;background:#070b1e;padding:40px;color:#fff">
  <table width="560" align="center" style="background:#101638;border-radius:16px;padding:32px;color:#fff">
    <tr><td>
      <h1 style="color:#28b9fc">Pagamento pendente</h1>
      <p style="color:#a0a8c0">Olá {{name}}, infelizmente seu pagamento do pedido #{{order_id}} não foi concluído.</p>
      <p>Você pode tentar novamente no link abaixo, sem precisar refazer o cadastro.</p>
      <p><a href="{{site_url}}/payment/{{order_id}}" style="background:#28b9fc;color:#070b1e;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:bold;display:inline-block">Tentar novamente</a></p>
    </td></tr>
  </table>
</div>
""",
    },
]
