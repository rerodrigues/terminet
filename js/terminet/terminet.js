jQuery(function(){
	var initData = utils.populateInitialData();
    window.tn = new Terminet(initData);
});

var Terminet = function(initData) {
	var tnData = _.extend(initData,{
		cidade : initData.cidade || "sao_paulo",
		isAssinante : 2,
		subscriber : Number(this.isAssinante) === 1,
		dataFile : initData.dataPath + "assine_v3_" + initData.cidade + (!initData.empresas == 1 ? ".jsonp" : "_empresas.jsonp")
	});
	
	var tnDefaults = {
		path : '/',
		session : {},
		allProducts : ['tv','internet','fone','celular','combo','combomulti']
	};
	
	_.extend(this, tnData, tnDefaults);
	
	(function(instance) {
		new AssineJaParser(instance, function() {
			_.extend(instance, this);
			
			$('#loading-cap').fadeOut(400,function(){
				new Terminal($('#terminal-container'));
			});
		});
	}(this));

    return this;
};


var Terminal = function(container){
	var tpl = function(string, data){
		data = data || {}
		var msgString = $('#tpl-'+string).html();
		
		return msgString ? _.template(msgString.replace(/^\s*|\s*$/gm,''), data) : ''
	};
	
	var options = { 
		prompt: function(cb){ cb(tpl('prompt'), {raw:true}) },
		height: $(document).height() + 'px', 
		exit : false,
		greetings: function(cb){ cb(tpl('greetings'), {raw:true}) },
		checkArity : false,
		keydown: function(e) {
			if (e.which === 82 && e.ctrlKey) { return true; }
		},
		onInit : function(term) {
			//tn.cart.addSelection({tvId:187, internetId:108, foneId:143}); //dbg
			//term.exec('push'); //dbg
		}
		/* exceptionHandler  */
		/* historyFilter  */
	}

	var commands = {
		help: function() {
			this.echo(tpl('help'), {raw:true});
		},
		
		ver : function() {
			this.echo(tpl('ver'), {raw:true});
		},
		
		pwd: function(){
			this.echo(tpl('pwd'), {raw:true});
		},
		
		commit : function(index) {
			if(index && tn.session.products && tn.session.products[index-1]) {
				var selectionIds = {},
					productType = tn.session.category,
					product = tn.session.products[index-1];
				
				if(productType == 'combo' || productType == 'combomulti') {
					selectionIds = {comboId : product.combo.id };
				} else {
					selectionIds[productType + 'Id'] = product.id;
				}
				
				tn.cart.addSelection(selectionIds);
				
				this.echo(tpl('commit',{ product : product }), {raw:true});
			} else if(index != undefined) {
				this.error('O produto informado &eacute; inv&aacute;lido.');
			}
		},
		
		cat : function(index){
			if(index && tn.session.products && tn.session.products[index-1]) {
				var data = { type: tn.session.category, index: index, product : tn.session.products[index-1]};
				
				this.echo(tpl('cat',data), {raw:true});
			} else if(index != undefined) {
				this.error('O produto informado &eacute; inv&aacute;lido.');
			}
		},
		
		cd: function(dir) {
			if(dir) {
				var newPath = dir;
				if(!dir.match(/^\//) && !dir.match(/^\.\.$/)) {
					newPath = tn.path + (!tn.path == '/' ? '/' : '') + dir;
					
				} else if (dir.match(/^\.\.$/)) {
					newPath = tn.path.replace(/\/[^/]+$/,'') || '/';
				}
				
				_(tn.session).extend(_(['category','option']).object(newPath.match(/([^/]+)/g) || [undefined,undefined]));
				
				if (newPath == "/" || newPath == ".." || newPath == '/cart') {
					if(newPath == '/cart' && !tn.cart.selection) {
						this.error('Voc&ecirc; ainda n&atilde;o tem nenhum produto em seu carrinho de compras.');
					} else {
						tn.path = newPath;
						delete tn.session.products;
						this.echo(tpl(newPath == '/cart' ? 'cart' : 'pwd'), {raw:true});
					}
					
				} else if(!tn.session.option && tn.data['has' + tn.session.category]){
					tn.path = newPath;
					tn.session.products = tn.session.category == 'combo' ? tn.data.filterCombos({multi:0}) :
										  tn.session.category == 'combomulti' ? tn.data.filterCombos({multi:1}) :
									      tn.data.filterProduct(tn.session.category);
										  
					this.echo(tpl('pwd'), {raw:true});
					
				} else {
					this.error('diretorio ' + dir + ' inv&aacute;lido.');
				}
			}
		},
		
		ls: function() {
			this.echo(tpl('ls'), {raw:true});
		}
	};
	
	var form = {
		push : function() {
			if(!tn.cart.selection) {
				this.error('Voc&ecirc; n&atilde;o tem nenhum produto em seu carrinho de compras.');
			} else {
				mainTerm = this;
				tn.session.form = {};
                //tn.session.form = { "callback": "parseResponse", "version": "v2", "customerProfile": "residencial", "cityId": "1", "cidade": "SÃ£o Paulo", "cidade_cookie": "sao_paulo", "estado": "SP", "canalDeMidia": "desktop", "comboId": "187_143_144_1581", "tvId": "187", "internetId": "143", "foneId": "144", "celularId": "1581", "nomeCompleto": "TESTE TI - RR", "email": "renato.rodrigues2@net.com.br", "ddd1": "11", "tel1": "988775566", "ddd2": "11", "tel2": "33449988", "cpf": "299.116.288-09", "rg": "23423423", "data": "02/12/1900", "cep": "03090-000", "endereco": "Rua passa gordo", "numero": "150", "complemento": "buteco", "bairro": "Jd lala", "dcc": "1", "fidelity": "1", "fatura_digital": "1", "emailBoleto": "renato.rodrigues2@net.com.br", "prospect": "true", "dataPagto": "15", "banco": "33", "agencia": "200", "contaCorrente": "9898-0", "agendamento": "4", "adicionais": "{}", "oferta": "Valor promocional do Combo Multi R$ 409,89 por 6 meses (mais as ligaÃ§Ãµes efetuadas com base no plano contratado) e a partir do 7Âº mÃªs R$ 449,79Â (mais as ligaÃ§Ãµes efetuadas com base no plano contratado).Â Oferta exclusiva com portabilidade do celular.Ganhe o dobro da velocidade na Banda Larga!Â 2 equipamentos NET HD, Wi-Fi e AntivÃ­rus GrÃ¡tis!Â NET TV R$ 140,00.Â NET VIRTUA R$ 30,00 por 6 meses e a partir do 7Âº mÃªs R$ 69,90.Â NET FONE R$ 39,90Â (mais as ligaÃ§Ãµes efetuadas com base no plano contratado).Â NET CELULAR R$ 199,99 (mais ligaÃ§Ãµes excedentes ao plano contratado). *Oferta Exclusiva para clientes NET que adquirirem o plano de telefonia mÃ³vel com portabilidade de linha pÃ³s-paga ativa nos Ãºltimos 3 meses.Â Taxa de instalaÃ§Ã£o: GrÃ¡tis.", "portabilidade[celular][id]": "celular", "portabilidade[celular][ddd]": "", "portabilidade[celular][tel]": "", "portabilidade[celular][operadora]": "", "portabilidade[fixo][id]": "fixo", "portabilidade[fixo][ddd]": "", "portabilidade[fixo][tel]": "", "portabilidade[fixo][operadora]": "", "features[]": "combo-multi,wifi-gratis,ponto-opcional-gratis,net-now,tv-alta-definicao-hd,tv-esportes,tv-filmes,tv-documentarios,tv-informacao,tv-infantil,tv-series,tv-noticias,app-net-now,internet-antivirus-gratis,internet-estudar-online,internet-modem-wifi-gratis,velocidade-15-mega,pacote-dados,fone-ligacoes-gratuitas-entre-net-fone,fone-ligacoes-para-celular,fone-ilimitado-para-outros-estados", "isMulti": "1", "produto[nome]": "Top HD   15 Mega   Ilimitado Brasil 21   Multi 3 GB", "produto[preco]": "40989", "produto[precoDe]": "51969", "produto[adesao]": "0", "produto[taxaInstalacao]": "0", "produto[produtos][tv][nome]": "Top HD", "produto[produtos][tv][preco]": "14000", "produto[nomes][]": "Multi 3 GB", "produto[produtos][internet][nome]": "15 Mega", "produto[produtos][internet][preco]": "3000", "produto[produtos][fone][nome]": "Ilimitado Brasil 21", "produto[produtos][fone][preco]": "3990", "produto[produtos][celular][nome]": "Multi 3 GB", "produto[produtos][celular][preco]": "19999", "produto[periodos][0][mes]": "1", "produto[periodos][0][atual]": "40989", "produto[periodos][0][anterior]": "0", "produto[periodos][0][ultimoMes]": "6", "produto[periodos][1][mes]": "7", "produto[periodos][1][atual]": "44979", "produto[periodos][1][anterior]": "40989", "produto[periodos][1][ultimoMes]": ""}; //dbg
				
				mainTerm.echo('<h2>Para continuar, favor informar os campos abaixo:</h2>', {raw:true});
				
				_(steps).each(function(stepPrompt, step){
					mainTerm.push(function(input, term) {
						input = input.replace(/^\s*|\s*$/g,'');
						
						if (input || step == "complemento" || step == "bairro") {
							if(step == 'tel1' || step == 'tel2'){ /* tel1 & tel2 */
								var which = step == 'tel1' ? 1 : 2,
									telParams = input.replace(/[^\d]/g,'').match(/^(\d\d)(\d{8,9})$/); /* todo */
									
								if(telParams && telParams.length == 3){
									tn.session.form['ddd' + which] = telParams[1];
									tn.session.form['tel' + which] = telParams[2];
									term.pop();
								} else {
									term.error('Favor informar o telefone no formato correto');
								}
							} else if /* validated fields */
								((step == 'email' && !input.match(/^.+@[^@]+\.[^@]{2,}$/)) ||  /* e-mail */
								 (step == 'cpf' && !input.match(/^\d{3}\.?\d{3}\.?\d{3}\-?\d{2}$/)) || /* cpf */
								 (step == 'data' && !input.match(/^\d{1,2}\/\d{1,2}\/(\d{4}|\d{2})$/)) || /* data */
								 (step == 'cep' && !input.match(/^\d{5}-?\d{3}$/)) || /* cep */
								 (step == 'agencia' && !input.match(/^\d+$/)) || /* agencia */
								 (step == 'banco' && !_(['33','104','237','341']).include(input)) || /* banco */
								 (step == 'dataPagto' && !_(['5','8','10','15','20']).include(input)) /* dataPagto */
								) { 
								term.error('Favor informar o campo no formato correto');					
							} else { /* all other fields */
								tn.session.form[step] = input;
								term.pop();
							}
						} else {
							term.error('O preenchimento deste campo &eacute; obrigat&oacute;rio.')
						}
						
						if(term.level() == 1) {
							mainTerm.pause();
							
							formUtils = new LegacyForm(tn.cart.selection);
							$('#_form').html(_.template($('#tpl-form').html()));
							
							formUtils.submit(
								function(data){
									term.echo(tpl('success'), {raw:true});
									mainTerm.resume();
								},
								function(jqXHR, textStatus, errorThrown){
									term.error('Erro ao enviar seu pedido: ' + errorThrown);
									console.log(jqXHR, textStatus, errorThrown);
									mainTerm.resume();
								}
							);
						};
						
					}, { prompt: stepPrompt + ' ' });
				});
			}
		},
	};
	
	var steps = {
		//'agendaInstalacao' : 'Qual o melhor dia para instalar net na sua casa?:',
		'contaCorrente' : 'Conta Corrente (com dígito):',
		'agencia' : 'Agência (sem dígito):',
		'banco' : 'Banco (33, 104, 237 ou 341):',
		'dataPagto' : 'Data de Vencimento (5, 8, 10 , 15 ou 20):',
		'bairro' : 'Bairro (opcional):',
		'complemento' : 'Complemento (opcional):',
		'numero' : 'Número:',
		'endereco' : 'Endereço completo:',
		'cep' : 'CEP:',
		'data' : 'Data de nascimento:',
		'rg' : 'RG:',
		'cpf' : 'CPF:',
		'tel2' : 'Telefone fixo com DDD (sim, acredite, isto é obrigatório):',
		'tel1' : 'Telefone celular com DDD:',
		'email' : 'E-mail:',
		'nomeCompleto' : 'Nome completo:',
	};
	
    var steps_dbg = {
        'debug' : 'debug mode',
    };
	
	return (container || document.body).terminal([commands, form], options);
};