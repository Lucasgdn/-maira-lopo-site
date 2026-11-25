# Plano da versao 3.0

## Situacao atual

Este documento registra ideias e proximas etapas; a versao 3.0 ainda nao esta
concluida. O projeto local inclui configuracao e processamento de lembretes,
resumos e avisos de pedidos, ainda pendentes de validacao real pela proprietaria.
Atualmente a agenda usa Firebase e identifica a profissional de cada reserva.
O atalho manual de lembrete continua disponivel no painel.
O pareamento real ja foi validado pelo usuario. A primeira biblioteca de conexao
foi substituida pela alternativa WPPConnect. O robo tambem usa Firebase para
se comunicar com o painel; a auditoria ainda aponta alertas transitivos do
Firebase. Nao ativar envios em producao antes de validar a operacao.

O painel permite escolher o numero particular, horarios e periodos dos
resumos, pendentes do dia e antecedencias em horas ou dias. Cada tipo de envio
comeca desligado. O robo usa horario de Brasilia e, ao voltar de uma
interrupcao, tenta mensagens ainda relevantes. Envios com resultado incerto
nao sao repetidos automaticamente e exigem conferencia no painel.

## Objetivo

Criar um robo integrado a agenda para enviar lembretes de agendamentos e
resumos diarios por WhatsApp, usando inicialmente o numero da esmalteria.
O robo sera um processo separado do site, executado em um servidor.

## Lembretes para clientes

- Consultar as reservas confirmadas e preparar uma mensagem com servico,
  profissional, data e horario.
- Enviar pelo numero da esmalteria no prazo que for escolhido.
- Antes do envio, verificar novamente se a reserva continua confirmada e se
  data e horario nao mudaram.
- Registrar a situacao de cada envio e evitar duplicacoes, inclusive apos
  reinicios e reagendamentos. Em caso de resultado incerto, nao presumir que
  a mensagem foi entregue nem repetir cegamente.
- O formulario informa que o salao pode enviar lembretes pelo WhatsApp.
  A administradora pode desativa-los para uma reserva no painel.

## Resumo diario

- Separar os atendimentos confirmados por profissional, mostrando horario,
  cliente e servico.
- Na primeira etapa funcional, configurar um numero para receber a agenda de
  todas, agrupada por profissional. No futuro, permitir tambem um numero por
  profissional para receber somente a propria agenda.
- Usar o numero da esmalteria como remetente nas duas opcoes. Usar numeros
  diferentes como remetentes exigiria conexoes separadas e fica fora da etapa
  inicial.
- O resumo representa a agenda no momento do envio. Avisos de mudancas
  posteriores ainda precisam ser definidos.

## Conexao e hospedagem

- Conectar o numero existente da esmalteria pelo QR code de dispositivos
  conectados do WhatsApp, exibido no painel administrativo protegido.
- Essa abordagem usa integracao nao oficial: pode deixar de funcionar apos
  atualizacoes e traz risco de restricao ou bloqueio do numero. Nao ha garantia
  de funcionamento permanente.
- O processo precisa ficar ligado e conectado, detectar desconexoes e permitir
  reconexao. Exibir no painel o estado da conexao e as falhas relevantes.
- Considerar uma maquina virtual gratuita na Oracle Cloud enquanto o servidor
  proprio nao estiver pronto. A disponibilidade e os limites do plano devem ser
  verificados; o cadastro geralmente exige cartao. Depois, o processo podera ser
  migrado para o servidor proprio, possivelmente exigindo novo pareamento.
- GitHub pode guardar o codigo e Vercel hospedar o site, mas nao sao a escolha
  para manter este processo continuamente conectado.
- Buscar ferramentas gratuitas, lembrando que energia, internet e eventuais
  limites dos servicos podem ter custos.

O codigo inicial fica em `robo-whatsapp/`, com dependencias independentes das
do site e requer Node.js 22.12 ou superior. A configuracao da conta restrita e
das regras esta descrita em `FIREBASE-SETUP.md`. A sessao local exige
armazenamento persistente; ela nao deve ser compartilhada ou adicionada ao Git.

## Seguranca e privacidade

- O QR code, a sessao do WhatsApp e as credenciais do robo devem ficar
  protegidos. Nao publica-los no repositorio, em logs ou em paginas publicas.
  O QR temporario fica no Firestore com acesso restrito; a sessao local pode
  conter historico e outros dados do WhatsApp.
- O documento `settings/availability` e publico; nao armazenar nele os
  numeros particulares nem outros dados privados da configuracao.
- Usar armazenamento privado e acesso restrito as administradoras autorizadas
  para os destinatarios, a configuracao e o estado do robo. Definir separadamente
  as permissoes minimas da identidade usada pelo servidor.
- Evitar expor dados de clientes em logs e limitar seu armazenamento ao
  necessario.
- Durante o desenvolvimento, nao criar reservas reais de teste nem enviar
  mensagens a clientes. A validacao real fica para a proprietaria.

## Etapas propostas

1. Preparar o processo separado e o pareamento por QR no painel,
   sem enviar mensagens nem consultar a agenda.
2. Publicar as regras atualizadas e instalar o codigo novo no servidor do robo.
3. Permitir que a proprietaria faca a validacao real antes de ativar os envios.
4. Configurar a hospedagem continua.

## Decisoes em aberto

- Se e como avisar alteracoes feitas depois do resumo.
- Politica de retencao dos registros de envio.
- Detalhes da hospedagem temporaria e validacao real da desconexao.

## Melhorias futuras

- Estudar controle financeiro e de comissoes: registrar pagamentos e despesas,
  acompanhar totais por periodo e valores pendentes, e calcular comissoes por
  profissional e servico. Definir regras para valores fixos ou percentuais,
  momento em que a comissao e devida, cancelamentos e descontos, alem de
  restringir o acesso aos dados financeiros. A versao e o escopo ainda nao
  foram definidos.
- Contas individuais para profissionais configurarem seu proprio numero.
- Possibilidade de oferecer planos mensais com funcionalidades diferentes,
  como um destinatario para a loja ou destinatarios individuais. Cobranca,
  planos e liberacao de funcionalidades nao fazem parte da etapa atual.
- Transformar o sistema em white label para saloes e barbearias, com nome e
  identidade visual proprios e uma agenda para cada estabelecimento.
- Criar um painel do dono da plataforma para cadastrar estabelecimentos,
  acompanhar assinaturas e definir planos e funcionalidades liberadas.
  Inicialmente, a administracao dos planos poderia ser manual; cobranca
  automatica seria uma etapa posterior.
- Cada estabelecimento teria sua propria conexao de WhatsApp, profissionais,
  servicos e clientes. Exigir separacao de dados e permissoes entre empresas e
  perfis de acesso adequados; o projeto atual atende uma unica esmalteria.
- Antes de vender em escala, avaliar a API oficial do WhatsApp, seus custos e
  regras, pois a integracao nao oficial pode sofrer bloqueios ou interrupcoes.
- Revisar a licenca da biblioteca WPPConnect e suas obrigacoes antes de
  disponibilizar ou distribuir uma versao comercial.
