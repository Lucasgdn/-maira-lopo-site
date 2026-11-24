# Configuracao do Firebase para o painel

O painel administrativo fica em `/admin`. Ele usa Firebase Authentication para e-mail e senha e Firestore para guardar os horarios. O site nao cria contas publicamente e nao guarda senhas.

## Criar o projeto

1. Acesse [Firebase Console](https://console.firebase.google.com/) com sua conta Google e crie um projeto.
2. No projeto, adicione um aplicativo Web e copie os valores de configuracao exibidos.
3. Em **Authentication > Sign-in method**, habilite **E-mail/senha**.
4. Em **Authentication > Users**, crie a conta da administradora. Use um e-mail seu e defina sua senha diretamente no Firebase; nao envie a senha pelo chat nem coloque no repositorio.
5. Em **Firestore Database**, crie o banco de dados.
6. Publique o conteudo de `firestore.rules` nas regras do Firestore.

## Configurar o site local

1. Copie `.env.example` para `.env.local`.
2. Preencha as seis variaveis `NEXT_PUBLIC_FIREBASE_*` com a configuracao do aplicativo Web.
3. Reinicie o servidor local.
4. Acesse `/admin` e copie o UID da conta criada em **Authentication > Users**.
5. No Firestore, crie a colecao `admins`. Crie um documento cujo ID seja exatamente esse UID e adicione o campo booleano `active` com valor `true`.
6. Entre em `/admin` com o e-mail e a senha que voce criou no Firebase.
7. Cadastre cada profissional, dias da semana, horario inicial/final e intervalos, depois salve.

As regras bloqueiam a criacao e alteracao da colecao `admins` pelo proprio site. O primeiro documento administrativo deve ser criado no Firebase Console, por uma pessoa com acesso de proprietaria ao projeto.

## Publicar

Configure as mesmas seis variaveis `NEXT_PUBLIC_FIREBASE_*` nas variaveis de ambiente da hospedagem e faca um novo deploy. Nunca adicione `.env.local` ao Git.

## Ajuda e navegacao

O menu do site tem o botao **Entrar**, alinhado a direita. Em telas estreitas, os links do menu podem rolar horizontalmente sem esconder o botao.

O site e o painel mostram a versao atual no rodape. A secao recolhivel **Ajuda e suporte** explica como agendar ou administrar a agenda. O botao **Relatar um problema pelo WhatsApp** abre uma conversa com a Maira e uma mensagem inicial contextualizada ao site ou ao painel; a pessoa pode completar e enviar a mensagem.

Depois do login, o painel abre no **Inicio**, com as reservas de hoje, pedidos
aguardando contato e estado do WhatsApp. O menu lateral separa **Agenda**,
**Reservas**, **Profissionais e horarios**, **WhatsApp** e **Ajuda e suporte**;
no celular, abra o menu pelo botao no topo. Os atendimentos de hoje incluem
reservas pendentes e confirmadas, mas nao incluem bloqueios manuais.

## Agenda e reservas

O painel salva disponibilidade semanal, excecoes de datas e eventos manuais em `settings/availability`. A agenda administrativa tem uma visao semanal inspirada no Outlook e uma visualizacao adaptada para celular. Fechamentos de data podem ser removidos pelo botao **Reabrir** no proprio evento.

No painel, os controles **Hoje**, **Semana anterior** e **Proxima semana** permitem navegar pela agenda. Em telas pequenas, o intervalo de datas fica compacto e os botoes de navegacao permanecem visiveis.

Na configuracao da rotina semanal, os campos de horario ficam empilhados no celular e passam para duas colunas em telas maiores para evitar sobreposicao.

Os botoes **Agendar** dos cards abrem o calendario publico. Cada card informa a duracao do servico; o sistema oferece inicios em intervalos de 15 minutos e reserva o tempo exato do servico em blocos internos de 5 minutos. Os horarios respeitam expediente, intervalos, eventos, excecoes e reservas existentes. A gravacao usa uma transacao do Firestore para impedir que duas clientes ocupem simultaneamente o mesmo intervalo.

Quando ha mais de uma profissional cadastrada, a cliente escolhe com quem deseja agendar antes de consultar as datas e horarios. A disponibilidade exibida e os bloqueios de reserva sao daquela profissional. O painel combina as reservas na agenda semanal, identifica o nome da profissional e permite filtrar a visualizacao por pessoa. Reservas simultaneas aparecem lado a lado na agenda semanal.

O pedido exige nome e celular/WhatsApp e aparece no painel como **Aguardando contato**. **Confirmar e avisar** atualiza o status e prepara uma mensagem de confirmacao no WhatsApp da cliente. **Cancelar e avisar** atualiza o status, remove os bloqueios de horario e prepara uma mensagem de cancelamento. Em reservas confirmadas, **Alterar data/horario** permite reagendar a cliente dentro da disponibilidade da profissional, sem conflito com outra reserva; ao salvar, abre uma mensagem pronta com a nova data e horario. **Enviar lembrete** prepara uma mensagem com servico, profissional, data e horario. As mensagens abrem para revisao e envio pela Maira; o site nao envia mensagens automaticamente nem cobra por esses links do WhatsApp. Se o navegador bloquear a abertura do WhatsApp durante uma mudanca de reserva, o painel oferece um link alternativo.

`settings/availability` pode ser lido publicamente para exibir horarios, mas continua editavel apenas por administradoras. `appointments` guarda os dados pessoais da cliente e so pode ser lido por administradoras ativas. `bookingSlots` guarda apenas os intervalos ocupados, sem nome ou telefone, e e consultado para montar os horarios livres.

As ideias para lembretes automaticos e resumos por profissional estao em [Plano da versao 3.0](./VERSAO-3.0.md). Elas ainda nao estao implementadas.

## Conexao do robo ao painel

Esta etapa apenas conecta ou desconecta o WhatsApp; nao envia mensagens nem
consulta a agenda. A conexao e nao oficial e pode sofrer bloqueios.

1. Publique as regras atualizadas de `firestore.rules` no Firebase Console.
2. Em **Authentication > Users**, crie uma conta de e-mail e senha exclusiva
   para o robo. Nao use a conta da administradora e nao envie a senha pelo chat.
3. No Firestore, crie `botOperators/{UID}`, usando o UID dessa conta, com o
   campo booleano `active` igual a `true`. Essa colecao so pode ser alterada
   pelo console; nao adicione essa conta a `admins`.
4. No computador ou servidor do robo, copie `robo-whatsapp/.env.example` para
   `robo-whatsapp/.env.local`. Preencha `BOT_FIREBASE_API_KEY`,
   `BOT_FIREBASE_PROJECT_ID` e `BOT_FIREBASE_AUTH_DOMAIN` com os valores
   correspondentes da configuracao Web do Firebase; preencha `BOT_EMAIL` e
   `BOT_PASSWORD` com a conta exclusiva do robo. Mantenha esse arquivo privado.
5. Com Node.js 22.12 ou superior, execute `npm ci --omit=dev` e depois
   `npm start` na pasta `robo-whatsapp`. Deixe o processo ligado e o relogio
   do computador correto.
6. Entre no painel como administradora. O QR aparece na secao **WhatsApp do
   robo**; escaneie em **Dispositivos conectados**. Nao compartilhe o QR.
   Apos conectar, **Desconectar** solicita ao robo a desvinculacao do aparelho.

Se o robo estiver desligado ou sem comunicacao, o painel informa que esta
offline e nao consegue executar a desvinculacao. Nesse caso, desconecte o
dispositivo pelo proprio WhatsApp. Parar o processo nao desvincula o aparelho;
a sessao local em `robo-whatsapp/.wppconnect` deve permanecer privada.
O QR fica em um documento Firestore restrito a administradoras e ao robo e e
apagado quando o estado muda. Se o processo cair inesperadamente, o ultimo QR
pode permanecer no documento, mas o painel deixa de exibi-lo apos expirar.

## Auditoria de dependencias

Em novembro de 2026, `npm audit --omit=dev` apontou alertas no `@grpc/grpc-js`,
dependencia transitiva do Firebase. Os avisos descrevem problemas ao executar
servidores gRPC: [validacao de certificados](https://github.com/advisories/GHSA-m9gg-hp2v-232j)
e [exposicao de erros](https://github.com/advisories/GHSA-f596-whhp-79r4).
O codigo do site usa o SDK Firebase como cliente e nao foi encontrado servidor
gRPC proprio. Isso nao elimina o alerta da auditoria; acompanhe atualizacoes
compativeis do Firebase e reavalie a exposicao ao mudar a arquitetura. Nao
force uma versao diferente do gRPC sem validar a compatibilidade.
