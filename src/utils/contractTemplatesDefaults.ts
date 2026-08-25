/**
 * Modelos padrão (seed) de contratos.
 * São inseridos automaticamente na primeira carga do backend e exibidos
 * como referência/reset no editor da página de Configurações.
 *
 * Variáveis disponíveis (substituídas na geração do PDF):
 *
 *  Empresa emissora:
 *   {{empresa.razao_social}}, {{empresa.cnpj}}, {{empresa.inscricao_estadual}},
 *   {{empresa.inscricao_municipal}}, {{empresa.endereco_completo}}, {{empresa.cidade}}
 *
 *  Cliente / contratante:
 *   {{cliente.nome}}, {{cliente.documento}}, {{cliente.documento_label}},
 *   {{cliente.endereco_completo}}
 *
 *  Contrato:
 *   {{contrato.numero}}, {{contrato.data_emissao}}, {{contrato.data_emissao_extenso}},
 *   {{contrato.data_entrega}}, {{contrato.data_recolhimento}}, {{contrato.hora_entrega}},
 *   {{contrato.local}}, {{contrato.objeto_descricao}},
 *   {{contrato.valor_total}}, {{contrato.valor_total_extenso}},
 *   {{contrato.valor_mensal}}, {{contrato.valor_mensal_extenso}},
 *   {{contrato.valor_unitario}}, {{contrato.valor_unitario_extenso}},
 *   {{contrato.qtd_sanitarios}}, {{contrato.qtd_sanitarios_extenso}},
 *   {{contrato.frete}}, {{contrato.frete_extenso}},
 *   {{contrato.data_vencimento}}, {{contrato.data_vencimento_extenso}},
 *   {{contrato.limpezas_semanais}}, {{contrato.observacoes}}
 */

export const TEMPLATE_OBRA_PADRAO = `
<p>Contrato de Locação e Prestação de Serviços que entre si firmam, de um lado, a empresa
<strong>{{empresa.razao_social}}</strong>, inscrita no CNPJ sob o nº {{empresa.cnpj}},
{{empresa.inscricao_estadual}}, {{empresa.inscricao_municipal}}, com sede na {{empresa.endereco_completo}},
doravante denominada <strong>LOCADORA</strong>; e, de outro lado,
<strong>{{cliente.nome}}</strong>, inscrita no {{cliente.documento_label}} sob o nº {{cliente.documento}},
com endereço {{cliente.endereco_completo}}, doravante denominada <strong>LOCATÁRIA</strong>,
ajustam entre si as cláusulas e condições a seguir:</p>

<h2>CLÁUSULA I – DO OBJETO</h2>
<p><strong>1.1.</strong> O presente contrato tem por objeto a locação de {{contrato.objeto_descricao}},
de propriedade da LOCADORA, à LOCATÁRIA, para uso temporário em atividades operacionais, canteiros de obras
ou quaisquer outras situações que exijam a disponibilização de instalações sanitárias móveis, exclusivamente
no local situado em {{contrato.local}}.</p>
<p><em>Parágrafo único</em> – Caberá à LOCADORA, a partir do dia {{contrato.data_entrega}}, a responsabilidade
pela retirada dos dejetos, bem como pela higienização dos equipamentos {{contrato.limpezas_semanais}} vez(es) por semana.</p>
<p><strong>1.2.</strong> Os banheiros químicos serão entregues pela LOCADORA no local indicado pela LOCATÁRIA,
devidamente higienizados, em condições de uso, e deverão ser mantidos conforme cronograma de limpeza e manutenção
acordado entre as partes.</p>
<p><strong>1.3.</strong> A LOCADORA efetuará a entrega e a retirada dos equipamentos nos locais indicados pela
LOCATÁRIA, conforme cronograma previamente acordado entre as partes, com antecedência mínima de 72 (setenta e duas) horas.</p>
<p><strong>1.4.</strong> A transferência ou mudança de local de instalação dos equipamentos por parte da LOCATÁRIA,
sem prévia autorização da LOCADORA, será de responsabilidade exclusiva da LOCATÁRIA pelo retorno ao local inicial.</p>

<h2>CLÁUSULA II – DA VIGÊNCIA, RENOVAÇÃO E DEVOLUÇÃO DOS BENS LOCADOS</h2>
<p><strong>II.1.</strong> O presente contrato terá prazo inicial de 01 (um) mês, podendo ser prorrogado ou
encerrado antecipadamente, conforme a necessidade da LOCATÁRIA.</p>
<p><em>Parágrafo primeiro</em> – Caso a LOCATÁRIA opte pela devolução antecipada dos sanitários antes do término
do período mensal contratado, não haverá cobrança proporcional, sendo devido o valor integral referente ao mês
completo de locação.</p>
<p><em>Parágrafo segundo</em> – O valor da locação será reajustado anualmente, a cada 12 (doze) meses, com base
na variação do Índice Geral de Preços – Mercado (IGP-M/FGV), ou em periodicidade menor, caso a legislação vigente
assim o permita.</p>
<p><strong>II.2.</strong> Caso a LOCATÁRIA não comunique à LOCADORA, por escrito, com antecedência mínima de
07 (sete) dias do término do prazo contratual, sua intenção de não renovar este contrato, bem como não realize
a devolução integral dos equipamentos locados até o último dia de vigência, o presente contrato será
automaticamente renovado por igual período, com emissão de nova fatura.</p>
<p><strong>II.3.</strong> O término do contrato somente será considerado efetivado após a entrega de todos os
bens locados, em perfeitas condições de funcionamento, sem qualquer anormalidade, no depósito da LOCADORA, que
realizará a devida conferência.</p>
<p><strong>II.4.</strong> Em caso de extravio, furto, roubo, perda ou qualquer outro evento que impossibilite
a devolução dos bens locados, a LOCATÁRIA compromete-se a pagar à LOCADORA o valor de mercado dos bens faltantes,
permanecendo vigente a cobrança da locação até a efetiva quitação do referido valor.</p>

<h2>CLÁUSULA III – DAS RESPONSABILIDADES DA LOCATÁRIA</h2>
<p><strong>III.1.</strong> A LOCATÁRIA compromete-se a utilizar os banheiros locados exclusivamente para os
fins previstos, zelando por sua conservação, funcionamento e guarda até a retirada pela LOCADORA.</p>
<p><strong>III.2.</strong> A LOCATÁRIA se obriga a fornecer todas as informações necessárias ao acesso ao local
da obra, incluindo:</p>
<ul>
  <li>Horários de funcionamento;</li>
  <li>Nome do responsável pela obra;</li>
  <li>Treinamentos exigidos;</li>
  <li>Protocolos de entrada;</li>
  <li>Documentações específicas exigidas pelo local.</li>
</ul>
<p><em>§1º</em> – A LOCADORA se exime de qualquer responsabilidade por atrasos ou falhas na prestação dos
serviços caso essas informações não sejam previamente repassadas.</p>
<p><em>§2º</em> – Caso haja necessidade de apresentação de documentos como PCMSO, PPRA, ASO, treinamentos
obrigatórios (NRs) ou similares, os custos serão arcados pela LOCATÁRIA.</p>

<h2>CLÁUSULA IV – DO PAGAMENTO</h2>
<p><strong>IV.1.</strong> A locação do(s) banheiro(s) químico(s) será cobrada mensalmente, sendo certo que o
valor das locações se refere sempre ao mês integral, independentemente do número de dias de uso, não havendo
cobrança proporcional.</p>
<p><strong>IV.2.</strong> O valor mensal da locação será de <strong>{{contrato.valor_mensal}}
({{contrato.valor_mensal_extenso}})</strong>, referente a {{contrato.qtd_sanitarios}} unidade(s) contratada(s).</p>
<p>O pagamento será efetuado por meio de boleto bancário, cujo vencimento constará expressamente no próprio boleto
e na respectiva nota fiscal, juntamente com a indicação do período da locação.</p>
<p><em>Parágrafo único</em> – O atraso no pagamento sujeitará a LOCATÁRIA à incidência de multa de 2% (dois por cento)
sobre o valor devido, juros moratórios de 1% (um por cento) ao mês e correção monetária pelo IGP-M/FGV. Decorrido
o prazo de 30 (trinta) dias de inadimplência, a LOCADORA poderá considerar o contrato rescindido de pleno direito,
procedendo à inclusão do nome da LOCATÁRIA nos cadastros de inadimplentes (SPC/SERASA) e ao protesto da dívida
em cartório, independentemente de notificação prévia.</p>
<p><strong>IV.3.</strong> Os boletos bancários serão enviados para o e-mail informado pela LOCATÁRIA no momento
da contratação, acompanhados das respectivas notas fiscais e faturas.</p>
<p><strong>IV.4.</strong> O valor referente ao frete de entrega e recolhimento dos equipamentos será cobrado
<strong>uma única vez</strong>, no importe de <strong>{{contrato.frete}} ({{contrato.frete_extenso}})</strong>,
lançado integralmente na primeira nota fiscal emitida em favor da LOCATÁRIA, não se repetindo nas faturas
subsequentes.</p>
<p><strong>IV.5.</strong> O primeiro vencimento dos boletos será em <strong>{{contrato.data_vencimento}}</strong>.</p>

<h2>CLÁUSULA V – DO FORO</h2>
<p><strong>V.1.</strong> Fica eleito o foro da comarca de <strong>{{empresa.cidade}}</strong> para dirimir
quaisquer dúvidas referentes a este contrato. E por estarem justos e contratados, os representantes das partes
assinam o presente instrumento na presença das testemunhas abaixo, em duas vias de igual teor e forma para um
só efeito.</p>
`.trim();

export const TEMPLATE_EVENTO_PADRAO = `
<p>Contrato de Prestação de Alocação e prestação de serviços, que entre si firmam, de um lado, a empresa
<strong>{{empresa.razao_social}}</strong>, inscrita no CNPJ sob o nº {{empresa.cnpj}},
{{empresa.inscricao_estadual}}, {{empresa.inscricao_municipal}}, com sede na {{empresa.endereco_completo}},
doravante denominada <strong>LOCADORA</strong>; e, de outro lado, a empresa
<strong>{{cliente.nome}}</strong>, inscrito no {{cliente.documento_label}} sob o nº {{cliente.documento}},
com sede {{cliente.endereco_completo}}, doravante denominado <strong>CONTRATANTE</strong>.</p>

<h2>CLÁUSULA I – DO OBJETO</h2>
<p><strong>I.1</strong> – O presente contrato tem por objeto a locação de <strong>{{contrato.objeto_descricao}}</strong>,
de propriedade da CONTRATADA (doravante denominada LOCADORA), à CONTRATANTE (doravante denominada LOCATÁRIA),
para uso temporário em atividades operacionais.</p>
<p>O contratado deverá entregar os sanitários em: <strong>{{contrato.local}}</strong>.</p>
<p>Data da entrega: <strong>{{contrato.data_entrega}}</strong>. A entrega deverá ser feita até as
<strong>{{contrato.hora_entrega}}</strong> horas.</p>
<p>Recolhimento: <strong>{{contrato.data_recolhimento}}</strong>. O recolhimento será realizado no período da manhã.</p>

<h2>CLÁUSULA II – DAS RESPONSABILIDADES DA LOCATÁRIA</h2>
<p><strong>II.1</strong> – O término do contrato somente será considerado efetivado após a entrega de todos os
bens locados, em perfeitas condições de funcionamento, sem qualquer anormalidade, no depósito da CONTRATADA, que
realizará a devida conferência.</p>
<p><em>Parágrafo único</em> – Caso os materiais ou equipamentos apresentem defeitos ou avarias, a CONTRATADA
apresentará orçamento de reparo à LOCATÁRIA para ciência, realizando posteriormente o faturamento dos custos
correspondentes.</p>
<p><strong>II.2</strong> – Em caso de extravio, furto, roubo, perda ou qualquer outro evento que impossibilite
a devolução dos bens locados, a LOCATÁRIA compromete-se a pagar à CONTRATADA o <strong>valor de mercado</strong>
dos bens faltantes, permanecendo vigente a cobrança da locação até a efetiva quitação do referido valor.</p>
<p><strong>II.3</strong> – A LOCATÁRIA compromete-se a utilizar os bens locados exclusivamente para os fins
previstos, zelando por sua conservação, funcionamento e guarda até a devolução.</p>
<p><em>§2º</em> – O não pagamento sujeitará a LOCATÁRIA ao envio do débito a protesto extrajudicial, sem
necessidade de aviso prévio ou notificação.</p>

<h2>CLÁUSULA IV – DO PAGAMENTO</h2>
<p><strong>IV.1.</strong> O pagamento será efetuado por meio de boleto bancário, cujo vencimento constará
expressamente no próprio boleto e no respectivo recibo de locação.</p>
<p><em>Parágrafo único</em> – O atraso no pagamento sujeitará a LOCATÁRIA à incidência de:</p>
<ul>
  <li><strong>Multa de 2% (dois por cento)</strong> sobre o valor devido;</li>
  <li><strong>Juros moratórios de 1% (um por cento) ao mês</strong>;</li>
  <li>Correção monetária pelo IGP-M/FGV.</li>
</ul>
<p>Decorrido o prazo de <strong>30 (trinta) dias de inadimplência</strong>, a CONTRATADA poderá considerar o
contrato rescindido de pleno direito, podendo ainda realizar a inclusão do nome da LOCATÁRIA nos cadastros de
inadimplentes (SPC/SERASA) e o protesto da dívida em cartório, independentemente de notificação ou aviso prévio.</p>
<p><strong>IV.2.</strong> Os boletos bancários serão enviados para o e-mail informado pela LOCATÁRIA no momento
da contratação, acompanhados das respectivas notas fiscais e faturas.</p>
<p><strong>IV.3</strong> – Valor total da locação: <strong>{{contrato.valor_total}}
({{contrato.valor_total_extenso}})</strong>.</p>
<p>O vencimento do boleto será no dia <strong>{{contrato.data_vencimento_extenso}}</strong>.</p>

<h2>CLÁUSULA V – DO FORO</h2>
<p><strong>V.1</strong> – Fica eleito o foro da comarca de <strong>{{empresa.cidade}}</strong> para dirimir
quaisquer dúvidas referentes a este contrato. E por estarem justos e contratados, os representantes das partes
assinam o presente instrumento na presença da testemunha abaixo, em duas vias de igual teor e forma para um só
efeito.</p>
`.trim();

export const TITULO_OBRA_PADRAO = 'CONTRATO DE LOCAÇÃO PARA OBRA — BANHEIROS QUÍMICOS';
export const TITULO_EVENTO_PADRAO = 'CONTRATO DE PRESTAÇÃO DE LOCAÇÃO E SERVIÇOS — EVENTO';

export const TEMPLATE_VARIABLES = [
  { group: 'Empresa emissora', vars: [
    'empresa.razao_social', 'empresa.cnpj', 'empresa.inscricao_estadual',
    'empresa.inscricao_municipal', 'empresa.endereco_completo', 'empresa.cidade',
  ]},
  { group: 'Cliente / contratante', vars: [
    'cliente.nome', 'cliente.documento', 'cliente.documento_label', 'cliente.endereco_completo',
  ]},
  { group: 'Contrato', vars: [
    'contrato.numero', 'contrato.data_emissao', 'contrato.data_emissao_extenso',
    'contrato.data_entrega', 'contrato.data_recolhimento', 'contrato.hora_entrega',
    'contrato.local', 'contrato.objeto_descricao',
    'contrato.valor_total', 'contrato.valor_total_extenso',
    'contrato.valor_mensal', 'contrato.valor_mensal_extenso',
    'contrato.valor_unitario', 'contrato.valor_unitario_extenso',
    'contrato.qtd_sanitarios', 'contrato.qtd_sanitarios_extenso',
    'contrato.frete', 'contrato.frete_extenso',
    'contrato.data_vencimento', 'contrato.data_vencimento_extenso',
    'contrato.limpezas_semanais', 'contrato.observacoes',
  ]},
];
