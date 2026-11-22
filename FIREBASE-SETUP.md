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

## Agenda e reservas

O painel salva disponibilidade semanal, excecoes de datas e eventos manuais em `settings/availability`. A agenda administrativa tem uma visao semanal inspirada no Outlook e uma visualizacao adaptada para celular. Fechamentos de data podem ser removidos pelo botao **Reabrir** no proprio evento.

No painel, os controles **Hoje**, **Semana anterior** e **Proxima semana** permitem navegar pela agenda. Em telas pequenas, o intervalo de datas fica compacto e os botoes de navegacao permanecem visiveis.

Na configuracao da rotina semanal, os campos de horario ficam empilhados no celular e passam para duas colunas em telas maiores para evitar sobreposicao.

Os botoes **Agendar** dos cards abrem o calendario publico. Cada card informa a duracao do servico; o sistema oferece inicios em intervalos de 15 minutos e reserva o tempo exato do servico em blocos internos de 5 minutos. Os horarios respeitam expediente, intervalos, eventos, excecoes e reservas existentes. A gravacao usa uma transacao do Firestore para impedir que duas clientes ocupem simultaneamente o mesmo intervalo.

Quando ha mais de uma profissional cadastrada, a cliente escolhe com quem deseja agendar antes de consultar as datas e horarios. A disponibilidade exibida e os bloqueios de reserva sao daquela profissional. O painel combina as reservas na agenda semanal, identifica o nome da profissional e permite filtrar a visualizacao por pessoa.

O pedido exige nome e celular/WhatsApp e aparece no painel como **Aguardando contato**. **Confirmar e avisar** atualiza o status e prepara uma mensagem de confirmacao no WhatsApp da cliente. **Cancelar e avisar** atualiza o status, remove os bloqueios de horario e prepara uma mensagem de cancelamento. Em reservas confirmadas, **Enviar lembrete** prepara uma mensagem com servico, profissional, data e horario. As mensagens abrem para revisao e envio pela Maira; o site nao envia mensagens automaticamente nem cobra por esses links do WhatsApp. Se o navegador bloquear a abertura do WhatsApp durante uma mudanca de status, o painel oferece um link alternativo.

`settings/availability` pode ser lido publicamente para exibir horarios, mas continua editavel apenas por administradoras. `appointments` guarda os dados pessoais da cliente e so pode ser lido por administradoras ativas. `bookingSlots` guarda apenas os intervalos ocupados, sem nome ou telefone, e e consultado para montar os horarios livres.
