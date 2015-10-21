var AssineJaParser = function(options, callback) {
    var privateData,
        publicData,
        defaultConditions,
        inst = this;

    this.init = function() {
        if (options.dataFile === undefined || callback === undefined) { return false; }

        defaultConditions = {
            dcc                 : options.dcc !== undefined                 ? String(options.dcc)                   == "true" : true,
            confort             : options.confort !== undefined             ? String(options.confort)               == "true" : true,
            fidelity            : options.fidelity !== undefined            ? String(options.fidelity)              == "true" : true,
            subscriber          : options.subscriber !== undefined          ? String(options.subscriber)            == "true" : true,
            digitalInvoice      : options.digitalInvoice !== undefined      ? String(options.digitalInvoice)        == "true" : true,
            portability         : options.portability !== undefined         ? String(options.portability)           == "true" : true,
            portabilityMobile   : options.portabilityMobile !== undefined   ? String(options.portabilityMobile)     == "true" : true
        };

        var defaults = {
            data : {
                tvEmptyId         : 0,
                internetEmptyId   : 0,
                foneEmptyId       : 0,
                celularEmptyId    : 0,
                foneBaseId        : 1, //Combo com qqr fone
                celularBaseId     : 1, //Combo com qqr celular
                dataFile          : options.dataFile
            },
            cart : {
                conditions : defaultConditions
            }
        };

        _.extend(data, defaults.data);
        _.extend(cart, defaults.cart, new SelectIds(options));

        publicData = {
            version: '1.0.2',
            cart : cart,
            data : data
        };

        this.getData(callback);

        return true;
    };

    this.getData = function(callback) {
        var dataTimestamp = new Date();
        var timestamp = [dataTimestamp.getFullYear(), dataTimestamp.getMonth() + 1, dataTimestamp.getDate(), dataTimestamp.getHours(), (dataTimestamp.getMinutes() < 30 ? '00' : '30' )].join('');

        $.ajax({
            url : data.dataFile,
            data: {timestamp: timestamp},
            cache: true,
            dataType : 'jsonp',
            jsonpCallback: 'parseResponse',
            async: false,
            type : 'POST',
            contentType : "application/x-www-form-urlencoded; charset=iso-8859-1",
            beforeSend : function(xhr) {
                xhr.setRequestHeader('Accept', "application/x-www-form-urlencoded; charset=iso-8859-1");
            },
            success : function(jsonData, textStatus, jqXHR) {
                _.extend(data, jsonData.data);
                privateData = _.omit(jsonData, ['data']);


                _.each(['tv','internet', 'fone', 'celular'], function(productType) {
                    data['has' + productType] = jsonData.produtos[productType] && (!!_.find(jsonData.produtos[productType], function(product) { return !product.somenteCombo; }));
                });

                data.hascombo = jsonData.combo && (!!_.find(jsonData.combo, function(combo) { return !!combo.exibir; }));


                data.hascombomulti = jsonData.combo && (!!_.find(jsonData.combo, function(combo) {
                    return !!combo.exibir && (!!combo.celularId || !!combo.tagAdditionalIds && hasTags(combo.tagAdditionalIds,'combo-multi'));
                }));

                cart.addSelection(cart);

                if (!!callback) { callback.call(publicData); }
            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.log('error:', jqXHR, textStatus, errorThrown);
            }
        });
    };

    function SelectIds(baseSelection) {
        if (baseSelection.comboId) {
            var produtctIds = baseSelection.comboId.split('_');
            baseSelection.tvId       = produtctIds[0];
            baseSelection.internetId = produtctIds[1];
            baseSelection.foneId     = produtctIds[2];
            baseSelection.celularId  = produtctIds[3];
        }

        return _.defaults({}, {
            tvId       : parseInt(baseSelection.tvId,10) || 0,
            internetId : parseInt(baseSelection.internetId,10) || 0,
            foneId     : parseInt(baseSelection.foneId,10) || 0,
            celularId  : parseInt(baseSelection.celularId,10) || 0
        }, {
            tvId       : data.tvEmptyId,
            internetId : data.internetEmptyId,
            foneId     : data.foneEmptyId,
            celularId  : data.celularEmptyId
        });
    }

    function getProducts(productIds, conditions, excludeAdditionals) {
        var selection = {};

        var tv       = data.getProductById('tv', productIds.tvId, productIds, conditions);
        var internet = data.getProductById('internet', productIds.internetId, productIds, conditions);
        var fone     = data.getProductById('fone', productIds.foneId, productIds, conditions);
        var celular  = data.getProductById('celular', productIds.celularId, productIds, conditions);

        if (tv       && tv.id != data.tvEmptyId)             { selection.tv       = tv; }
        if (internet && internet.id != data.internetEmptyId) { selection.internet = internet; }
        if (fone     && fone.id != data.foneEmptyId)         { selection.fone     = fone; }
        if (celular  && celular.id != data.celularEmptyId)   { selection.celular  = celular; }

        return tv || internet || fone || celular ? selection : undefined;
    }

    function getCombo(itemType, rawItem, excludeAdditionals) {
        var selection;
        rawItem = getRawItem(rawItem);

        if (typeof(rawItem) === "object") {
            var conditions   = _.extend({}, cart.conditions, { fidelity : true }); /* [[TODO]] Possivel bug no extend? */
            var selectionIds = new SelectIds(rawItem);
                selection    = getProducts(selectionIds, conditions, excludeAdditionals);

            var item = calculateItem('combo', rawItem, rawItem, conditions);
            item.nome = _.compact([(selection.tv ? selection.tv.nome : null), (selection.internet ? selection.internet.nome : null), (selection.fone ? selection.fone.nome : null), (selection.celular ? selection.celular.nome : null)]).join(" + ");
            item.preco   = cart.getMontly(selection, {ignoreAdditionals: true})
            item.precoDe = cart.getMontlyFrom(selection, {ignoreAdditionals: true});

            var tvIds = _.chain(privateData[itemType]).filter(function(tmpItem) {
                return (!selection.tv && !tmpItem.tvId || selection.tv && selection.tv.id !== tmpItem.tvId) &&
                       (!selection.internet && !tmpItem.internetId || selection.internet &&selection.internet.id == tmpItem.internetId) &&
                       (!selection.fone && !tmpItem.foneId || selection.fone && selection.fone.id == tmpItem.foneId) &&
                       (!selection.celular && !tmpItem.celularId || selection.celular && selection.celular.id == tmpItem.celularId);
            }).pluck('tvId').unique().compact().value();

            if (tvIds.length > 0) {
                item.tvIds = tvIds.sort();
            }

            var foneIds = _.chain(privateData[itemType]).filter(function(tmpItem) {
                return (!selection.tv && !tmpItem.tvId || selection.tv && selection.tv.id == tmpItem.tvId) &&
                       (!selection.internet && !tmpItem.internetId || selection.internet &&selection.internet.id == tmpItem.internetId) &&
                       (!selection.celular && !tmpItem.celularId || selection.celular && selection.celular.id == tmpItem.celularId) &&
                       (!selection.fone || !!tmpItem.foneId && selection.fone.id !== tmpItem.foneId && tmpItem.foneId !== data.foneBaseId);
            }).pluck('foneId').unique().compact().value();

            if (foneIds.length > 0) {
                item.foneIds = foneIds.sort();
            }

            var celularIds = _.chain(privateData[itemType]).filter(function(tmpItem) {
                return (!selection.tv && !tmpItem.tvId || selection.tv && selection.tv.id == tmpItem.tvId) &&
                       (!selection.internet && !tmpItem.internetId || selection.internet &&selection.internet.id == tmpItem.internetId) &&
                       (!selection.fone && !tmpItem.foneId || selection.fone && selection.fone.id == tmpItem.foneId) &&
                       (!selection.celular || !!tmpItem.celularId && selection.celular.id !== tmpItem.celularId && tmpItem.celularId !== data.celularBaseId );
            }).pluck('celularId').unique().compact().value();

            if (celularIds.length > 0) {
                item.celularIds = celularIds.sort();
            }

            item.periodos = cart.getPeriodos(selection,{ignoreAdditionals: true});

            item.desmembravel = ((!!selection.tv && !selection.tv.somenteCombo) && (!!selection.internet && !selection.internet.somenteCombo) && (!!selection.fone && selection.fone.id != data.foneBaseId && !selection.fone.somenteCombo && !!item.foneIds) && (!selection.celular || selection.celular.id != data.celularBaseId && !selection.celular.somenteCombo && !!item.celularIds) );

            selection[itemType] = item;
        }

        return selection || undefined;
    }

    function getRawItem(rawItem) {
        if (typeof(rawItem) === "object") {
            rawItem = _.clone(rawItem);

            var deals = privateData.ofertas && privateData.ofertas[rawItem.ofertaId];
            if (deals) {
                rawItem.ofertas = deals;
            }

            var badges = privateData.extras && privateData.extras.selos && privateData.extras.selos[rawItem.seloId];
            if (badges) {
                rawItem.selos = badges;
            }

            if (rawItem.tagIds && privateData.tags) { //hasTags
                rawItem.tags = _.chain(rawItem.tagIds).map(function(tagId) {
                    return privateData.tags[tagId];
                }).compact().value();
            }

            if (rawItem.adicionaisIds && privateData.adicionais && privateData.adicionais.grupos && privateData.adicionais.opcoes) { //hasAdditional
                additionalItem = {};
                _.each(rawItem.adicionaisIds,function(adicionaisId) {
                    var adicional = privateData.adicionais.grupos[adicionaisId], opcoes;

                    if ('undefined' !== typeof adicional) {
                        opcoes = _.chain(adicional.opcoes).map(function(opcaoId) {
                            var opcao = data.getAdditionalById(opcaoId);
                            _.extend(opcao, {
                                'tvAdicional': adicional.tvAdicional || 0,
                                'multipleChoice': adicional.multipleChoice || 0
                            });
                            if (!adicional.multipleChoice) {
                                opcao.otherOptions = _.without(adicional.opcoes, opcaoId);
                            }
                            return opcao;
                        }).value();

                        additionalItem[adicionaisId] = {
                            nome: adicional.nome,
                            id: adicional.id,
                            opcoes: opcoes,
                            tvAdicional: adicional.tvAdicional || 0,
                            required: adicional.required || 0,
                            multipleChoice: adicional.multipleChoice || 0
                        };
                    }
                });
                rawItem.adicionais = additionalItem;
            }

            if (rawItem.canaisIds && privateData.canais) { //hasCanais
                rawItem.listaCanais = _.map(rawItem.canaisIds, function(canalId) {
                    return data.getCanal(canalId);
                });
                rawItem.canais = _.size(rawItem.listaCanais || []);
            }

            if (rawItem.canaisPrincipaisIds && privateData.canais) { //hasCanaisPrincipais
                rawItem.canaisPrincipais = _.chain(rawItem.canaisPrincipaisIds).sortBy('canalId').map(function(canalId) {
                    var canal = data.getCanal(canalId);
                    return !!canal && !!canal.id  ? canal : undefined;
                }).compact().value();
            }

            if (rawItem.recursosIds && privateData.extras && privateData.extras.tabelasDeAtributos &&  privateData.extras.tabelasDeAtributos.atributos ) { //hasRecursos
                rawItem.recursos = _.chain(rawItem.recursosIds).map(function(recursoId) {
                    return privateData.extras.tabelasDeAtributos.atributos[recursoId];
                }).compact().value();
            }

            if (rawItem.tabelaId && privateData.extras.tabelasDeAtributos && privateData.extras.tabelasDeAtributos.tabelas && privateData.extras.tabelasDeAtributos.atributos) {
                var tabelasDeAtributos = privateData.extras.tabelasDeAtributos,
                    atributos = tabelasDeAtributos.atributos,
                    tabela = tabelasDeAtributos.tabelas[rawItem.tabelaId];

                if (tabela) {
                    rawItem.tabelaDeAtributos = {};
                    for (var attr in tabela) {
                        var atributo = (atributos) ? atributos[attr] : false,
                            categoria = (atributo && atributo.categoriaId) ? tabelasDeAtributos.categorias[atributo.categoriaId] : "Outros",
                            obj = {};

                        if (!atributo || !categoria) {
                            continue;
                        }
                        if (!rawItem.tabelaDeAtributos[categoria]) {
                            rawItem.tabelaDeAtributos[categoria] = {};
                        }

                        obj = {
                            "descricao" : atributo.descricao,
                            "destaque" : atributo.destaque,
                            "valor" : tabela[attr]
                        };

                        rawItem.tabelaDeAtributos[categoria][atributo.nome] = obj;

                    }
                }
            }
        }

        return rawItem || undefined;
    }

    function setPeriodos(ofertas, prices) {
        var conditions = cart.conditions;
        var len = _.size(ofertas);
        var last = _.last(ofertas);
        if (len === 0) { return prices; }
        prices = prices || [];
        for (var l = last.ate - 1; l>=0; l--) {
            prices[l] = last.preco;
        }
        ofertas.pop();
        return setPeriodos(ofertas,prices);
    }

    // calculo individual de periodos.
    // verifica se há 1 periodo, senao pega valor "default", (se for dum combo, não tem id)
    function calculatePeriodos (rawItem, options) {
        var periodos = rawItem.periodos || [],
            periodos_ = false,
            portability = false,
            defaults = {};

        options = _.extend(defaults, options || {});

        if (!!options.ofertas) {
            ofertas = _.toArray(options.ofertas);
            periodos_ = setPeriodos(ofertas);
        }
        if (!!options.conditions && !!(options.itemType === 'celular' || options.itemType === 'fone')) {
            portability = options.conditions[(options.itemType === "fone" ? 'portability' : 'portabilityMobile')];
        }


        for (var mes = periodos.length ; mes < 13; mes++) {
            var preco = 0;
            if (options.itemType === 'fone' || options.itemType === 'celular') {
                preco +=  (!portability && rawItem.acrescimoNaoPN !== undefined) ? rawItem.acrescimoNaoPN : 0;
            }

            if (!!periodos_ && _.isNumber(periodos_[mes])) {
                preco += periodos_[mes];
                periodos.push(preco);
            } else {
                preco +=  (rawItem.acrescimoNaoDCC !== undefined && !options.conditions.dcc) ? rawItem.acrescimoNaoDCC : 0;
                preco +=  (rawItem.acrescimoNaoFD !== undefined && !options.conditions.digitalInvoice) ? rawItem.acrescimoNaoFD : 0;
                if (!rawItem.id) {
                    preco += rawItem.preco || 0;
                    periodos.push(preco);
                } else if (!!rawItem.id) {
                    preco += rawItem.precoDe || 0;
                    periodos.push(preco);
                }
            }
        }
        return periodos;
    }

    function calculateItem(itemType, rawItem, selectionIds, conditions) {
        var product = getRawItem(rawItem); //Retorna produto bruto


        if (product) {
            conditions   = _.extend({}, cart.conditions, conditions);
            selectionIds = selectionIds || cart;

            var selectedIds = new SelectIds(selectionIds);
            var deal;
            selectedIds[itemType + "Id"] = product.id;
            product.oferta = "";

            // [[TODO]] talvez dê problema para saber o valor single mais caro.
            if ( product.precoDe === undefined && product.preco !== undefined) { product.precoDe = product.preco; }
            if (product.ofertas && conditions.fidelity) { //calcula oferta correta
                var subscriber          = conditions.subscriber         ? 'c' : 'p', // Cliente ou não cliente?      (Default: não cliente)
                    confort             = conditions.confort            ? 'f' : 'b', // Conforto ou básico?          (Default: conforto)
                    dcc                 = conditions.dcc                ? 'd' : 'n', // DCC ou boleto?               (Default: DCC)
                    digitalInvoice      = conditions.digitalInvoice     ? 'd' : 'i', // Fatura digital ou impressa?  (Default: digital)
                    dealType            = subscriber + confort + dcc + digitalInvoice;

                deal = product.ofertas[dealType];
                if (deal) {
                    product.oferta = product.ofertas[dealType].texto;
                    if (deal.periodo) {
                        product.periodos = calculatePeriodos(product, {'conditions': conditions, 'ofertas': deal.periodo, 'itemType': itemType});
                        _.extend(product, deal.periodo[0]);
                    }
                }
            }

            if (!deal || !deal.periodo) {
                product.periodos = calculatePeriodos(product, {'conditions': conditions, 'itemType': itemType});
            }

            if (!conditions.dcc && product.acrescimoNaoDCC !== undefined) { //acrescenta DCC de acordo com a condição
                if ((!deal || !deal.periodo) && product.preco !== undefined) { product.preco += product.acrescimoNaoDCC; }
                if (product.precoDe !== undefined) { product.precoDe += product.acrescimoNaoDCC; }
            }

            if (!conditions.digitalInvoice && product.acrescimoNaoFD !== undefined) { //acrescenta acrescimo de Fatura impressa de acordo com a condição
                if ((!deal || !deal.periodo) && product.preco !== undefined) { product.preco += product.acrescimoNaoFD; }
                if (product.precoDe !== undefined) { product.precoDe += product.acrescimoNaoFD; }
            }


            if (product.adesao !== undefined && (!conditions.fidelity && product.adesaoNaoFidelidade !== undefined)) {
                product.adesao = product.adesaoNaoFidelidade;
            }

            if (product.acrescimoNaoPN !== undefined && ((itemType === "fone" && !conditions.portability) || (itemType === "celular" && !conditions.portabilityMobile))) {
                if (product.preco   !== undefined) { product.preco   += product.acrescimoNaoPN; }
                if (product.precoDe !== undefined) { product.precoDe += product.acrescimoNaoPN; }
            }

            var joinedIds = [selectedIds.tvId, selectedIds.internetId, selectedIds.foneId];
            if (!!selectedIds.celularId) {
                joinedIds.push(selectedIds.celularId);
            }
            joinedIds = joinedIds.join('_');

            var tmpSelection = _.clone(privateData.selecoes[joinedIds]);
            if (tmpSelection && tmpSelection[itemType]) { //Verifica se tem seleção
                tmpSelection[itemType].precoDe = product.precoDe;

                var calculatedSelection = calculateItem(itemType, tmpSelection[itemType], selectedIds, conditions);
                _.extend(product, calculatedSelection);
            }

            if (selectedIds.tvId != data.tvEmptyId && selectedIds.internetId != data.internetEmptyId && selectedIds.foneId != data.foneEmptyId) { //Se tiver os 3 produtos
                var tmpCombo = _.clone(privateData.combo[joinedIds]);
                if (tmpCombo && tmpCombo[itemType]) { //Verifica se "comba"
                    tmpCombo[itemType].precoDe = product.precoDe;

                    var calculatedCombo = calculateItem(itemType, tmpCombo[itemType], selectedIds, conditions);
                    _.extend(product, calculatedCombo);
                }
            }

            var productAttibutes = ['adesao','id','taxaInstalacao','nome','oferta','preco','precoDe','canais','vantagens','somenteCombo','somentePortabilidade','selos','tags','adicionais','canaisPrincipais','listaCanais','recursos','recursos_descritivos','cabecalho','ate','tabelaDeAtributos','exibir','ordem'];
            if (!!product.periodos && product.periodos.length > 0) { productAttibutes.push('periodos'); }

            return _.pick(product, productAttibutes);
        } else {
            return undefined;
        }
    }

    function getTagId(tagName) {
        var tagId;
        if (tagName) {
            _.each(privateData.tags, function(name, id) { if (name == tagName) {tagId = Number(id); } } );
        }
        return tagId;
    }

    function hasTags(productTagIds, tagNames) {
        return _.chain(tagNames.split(',')).map(function(tag) {
            return _.include(productTagIds, getTagId(tag));
        }).include(false).value() !== true;
    }

    var data = {
        filterProduct : function(productType, tagNames, options) {
            var products = [],
                comboMultiId = getTagId('combo-multi'),
                isFoneSingle = !!(productType == 'fone' && (!cart.selection || !cart.selection.tv && !cart.selection.internet)), //[RR] Nao tenho certeza se isto está de acordo com as regras
                defaults = {};

            options = _.extend(defaults, options || {});

            var productBaseId = data[productType + 'BaseId'],
                isBase  = !!cart.selection && !!cart.selection[productType] && cart.selection[productType].id == productBaseId,
                selecaoIds = _.pick(cart,['tvId', 'internetId', 'foneId', 'celularId']),
                isCombo = !!cart.selection && !!cart.selection.combo;

            _(privateData.produtos[productType]).chain()
                .filter(function(product) {
                    selecaoIds[productType+'Id'] = product.id;
                    var joinedIds = [selecaoIds.tvId, selecaoIds.internetId, selecaoIds.foneId];
                    if (!!selecaoIds.celularId) { joinedIds.push(selecaoIds.celularId); }
                    var canBeCombo = privateData.combo[joinedIds.join('_')]; // combinação do cart.selection com o produto esperado

                    return  (!!options.showAll || (product.exibir === undefined || !!product.exibir )) &&
                            (!product.somenteCombo || !!canBeCombo || isCombo && isBase && product.id != productBaseId) && //[RR] Nao tenho certeza se isto está de acordo com as regras
                            (!(isFoneSingle && _.include(product.tagIds, comboMultiId))) &&
                            (!tagNames || hasTags(product.tagIds, tagNames)) &&
                            (!options.inIds || _.contains(options.inIds, product.id));

                }).each(function(product) {
                    var selectionIds = cart.comboId ? {} : cart,
                        selectedIds  = new SelectIds(selectionIds),
                        item = data.getProductById(productType, product.id, selectedIds);

                    if (item) {
                        products.push(item);
                    }
                });

            return _.sortBy(products, 'ordem');
        },

        /**
         * @name filterCombos
         * @description filtrar combos do json
         * @param  {json} options
         * @return {[array]}
         *
         * options = {
         *      'showAll' : '(bool) desativa filtros (tags, exibir, etc)',
         *      'selections' : '(bool) incluir seleções (double e triple) aos combos',
         *      'tagsCombo' : '(array) filtrar combos que usam tais tags ',
         *      'tagsProduct' : '(array) filtrar combos que os produtos usam tais tags ',
         *      'context': '(json) filtra combos com um produto especifico (ex.: {'tvId':0,'internetId':0,'foneId':0}',
         *      'multi' : '(bool) caso passado 1 retorna apenas combos multi, caso passado 0 retorna apenas combo (sem celular), caso não passado retorna todos (com e sem celular, DEFAULT),
         *      'orderBy': '(string) ordena os combos de acordo com o parametro (ordem, DEFAULT)
         * }
         *
         */
        filterCombos : function (options) {
            var combos = [],
                defaults = {
                    orderBy: 'ordem',
                    multi: null
                };

            options = _.extend(defaults, options || {});

            var products = !!options.selections    ? _.extend({},privateData.selecoes, privateData.combo) :
                           !!options.onlySelection ? privateData.selecoes : privateData.combo;

            _.chain(products).filter(function(product) {
                return (
                    // Filtra combos/selecoes conforme o contexto de tv/internet/fone/celular
                    (!options.context || ((!options.context.tvId || product.tvId && parseInt(options.context.tvId,10) === product.tvId ) && (!options.context.internetId || product.internetId && parseInt(options.context.internetId,10) === product.internetId ) && (!options.context.foneId || product.foneId && parseInt(options.context.foneId,10) === product.foneId ) && (!options.context.celularId || product.celularId && parseInt(options.context.celularId,10) === product.celularId ))) &&

                    // Filtra combos/selecoes com exibir == 1 quando não passar parametro
                    (!!options.showAll || !!product.exibir) &&

                    // Filtra combo multi ou combo
                    (options.multi === null || (Boolean(options.multi) === Boolean(product.celularId))) &&

                    // Filtra combos/selecoes com as tags
                    (!options.tagsCombo || !!product.tagIds && hasTags(product.tagIds, options.tagsCombo)) &&

                    // Filtra combos/selecoes com os produtos que tenham as tags
                    (!options.tagsProduct || !!product.tagAdditionalIds && hasTags(product.tagAdditionalIds, options.tagsProduct))
                );
            }).each(function(product){
                var productType = privateData.combo[product.id] ? 'combo' : 'selecoes',
                    tmpProduct  = getCombo(productType, product, true);

                if (tmpProduct) {
                    combos.push(tmpProduct);
                }
            });

            return _.sortBy(combos, function(combinacao) {
                var combinado = combinacao.combo || combinacao.selecoes;
                return combinado[options.orderBy] || 99999;
            });
        },

        /**
         * @name FilterSelections
         * @description filtra as seleções do json
         * @param  {json} options
         * @return {array}
         */
        filterSelections: function(options) {
            options = _.extend(options || {}, { onlySelection: true });
            return data.filterCombos(options);
        },

        /**
         * @name filterAll
         * @description filtrar combos, seleções e produtos do json
         * @param  {json} options
         * @return {[type]}
         *
         * options = {
         *      'showAll' : '(bool) desativa filtros (tags, exibir, etc)',
         *      'selections' : '(bool) incluir seleções (double e triple) aos combos',
         *      'tags' : '(array) filtrar combos e seleções e produtos que usam tais tags ',
         * }
         *
         */
        filterAll: function(options) {
            var defaults = {
                showAll: false,
                selections: true
            };

            options = _.extend(defaults, options || {});

            var products = {
                    'combo' : data.filterCombos({tagsCombo:options.tags, showAll: options.showAll, selections: options.selections}),
                    'tv' : data.filterProduct('tv', options.tags, {showAll:options.showAll}),
                    'internet' : data.filterProduct('internet', options.tags, {showAll:options.showAll}),
                    'fone' : data.filterProduct('fone', options.tags, {showAll:options.showAll}),
                    'celular' : data.filterProduct('celular', options.tags, {showAll:options.showAll})
                },
                result = [];


            _.each(['tv', 'internet', 'fone', 'celular'], function(type) {
                var _result = _.map(products[type],function(product) {
                    product.type = type;
                    return product;
                });
                result = _.union(result, _result);
            });

            result = _.union(result, _.map(products.combo,function(product) {
                var productType = (product.combo) ? 'combo' : 'selecoes';
                _.extend(product, product[productType]);
                product = _.omit(product, [productType]);
                product.type = productType;
                return product;
            }));

            return result || [];
        },

        getProductById : function(productType, productId, selectionIds, conditions) {
            return privateData.produtos[productType] ?
                calculateItem(productType, privateData.produtos[productType][productId], selectionIds, conditions) : false;
        },

        getComboById : function(comboId, itemType) {
            itemType = itemType || 'combo';
            return getCombo(itemType,privateData[itemType][comboId]);
        },

        getSelection : function(selectedIds) {
            selectedIds = SelectIds(selectedIds);
            var selection = getProducts(selectedIds);

            if (selection && selection.tv && selection.internet && selection.fone && (!selectedIds.celularId || !!selection.celular)) { //Se tiver os 3 produtos
                var tmpCombo = data.filterCombos({'context': selectedIds, showAll: 1, multi: !!selection.celular ? 1 : 0 });

                if (_.size(tmpCombo) > 0) { //Verifica se "comba"
                    selection.combo = tmpCombo[0].combo;
                    cart.comboId = tmpCombo[0].combo.id;
                }
            }

            return selection;
        },

        getCategoria : function(categoriaId) {
            if (privateData.extras && privateData.extras.categorias) {
                return privateData.extras.categorias[categoriaId];
            }
        },

        getPrice : function (itemType, selection) {
            return calculateItem(itemType, selection, {});
        },

        getPrivateData: function() {
            console.log('privateData', privateData);
            return false;
        },

        getRecursosPadrao: function(itemType) {
            var extras = privateData.extras;
            if (extras && extras.recursos_padrao && extras.tabelasDeAtributos && extras.tabelasDeAtributos.atributos) {

                var recursos_padrao = extras.recursos_padrao[itemType] || [];
                var recursosPadrao = _.chain(recursos_padrao).map(function (id) {
                    return extras.tabelasDeAtributos.atributos[id].nome;
                }).compact().value();
                return recursosPadrao;
            }
            return [];
        },

        getRecursosPadraoIds: function(itemType) {
            if (privateData.extras && privateData.extras.recursos_padrao) {
                return privateData.extras.recursos_padrao[itemType];
            }
            return [];
        },

        getAtributosDestaqueIds: function (itemType) {
            if (!!privateData.extras.tabelasDeAtributos && !!privateData.extras.tabelasDeAtributos.destaques && !!privateData.extras.tabelasDeAtributos.destaques[itemType]) {
                return privateData.extras.tabelasDeAtributos.destaques[itemType];
            }
            return [];
        },

        getAtributosDestaque: function(itemType) {
            var atributos = this.getAtributosDestaqueIds(itemType),
                formatedData = {};

            for (var i = 0, attrL = atributos.length; i < attrL; i++) {
                var atributoId = atributos[i],
                    atributo = privateData.extras.tabelasDeAtributos.atributos[atributoId],
                    categoria = (atributo.categoriaId) ? privateData.extras.tabelasDeAtributos.categorias[atributo.categoriaId] : "Outros";

                if (!atributo.destaque) {
                    continue;
                }

                formatedData[categoria] = formatedData[categoria] ? formatedData[categoria] : [];

                formatedData[categoria].push(atributo.nome);

            }

            return formatedData;

        },

        getCanal: function(canalId) {
            var canal = privateData.canais.lista[canalId] || {},
                categoria = canal.categoriaId ? privateData.canais.categorias[canal.categoriaId] : false;

            if (categoria) {
                canal.categoria = categoria.nome;
            }

            return canal;
        },

        filterCanais: function(categoriaId) {
            return _.chain(privateData.canais.lista).filter(function (canal) {
                return !categoriaId || canal.categoriaId === categoriaId;
            }).map(function(canal) {
                return data.getCanal(canal.id);
            }).value();
        },

        getCanaisCategorias: function() {
            return privateData.canais.categorias || [];
        },
        getCanaisByTvId: function(tvId) {
            var categorias = data.getCanaisCategorias();
            var tv = data.getProductById('tv',tvId);
            var listaCanais = {};
            var tvPrivate = privateData.produtos.tv[tvId];

            _.chain(categorias).sortBy(function(categoria){
                    return categoria.nome;
                }).each(function(categoria) {
                    var listaCanaisPorCategoria = _.filter(tv.listaCanais, function(canal){return canal.categoriaId == categoria.id;});
                    if (_.size(listaCanaisPorCategoria)) {
                        listaCanais[categoria.nome] = listaCanaisPorCategoria;
                    }
                });

            return listaCanais;
        },

        // [[TODO]] melhorar essa função
        getAdditionalById: function(additionalId) {
            additionalId = (additionalId).toString();
            var adicional = privateData.adicionais && privateData.adicionais.opcoes ? privateData.adicionais.opcoes[additionalId] : false;

            if (!adicional) { return false; }

            adicional = calculateItem('', adicional, {});

            if (privateData.adicionais.opcoes[additionalId] && privateData.adicionais.opcoes[additionalId].categoriaId) {
                adicional.categoria = data.getCategoria(privateData.adicionais.opcoes[additionalId].categoriaId);
            }

            return _.omit(adicional, ['categoriaId', 'oferta']);
        },

        getLowestPrice: function (itemType, productId, options) {
            var combos, produto;
            options = _.defaults({'showAll':1, 'context': {}}, options);
            options.context[itemType + 'Id'] = productId;

            combos = this.filterCombos(options);

            produto = (!combos.length) ?
                this.getProductById(itemType, productId) || {} :
                _.chain(combos).sortBy(function(combinacao) {
                    return combinacao[itemType].preco;
                }).first().tap(function(combinacao) {
                    combinacao[itemType].comboReferenceId = combinacao.combo.id;
                }).value()[itemType];

            return _.pick(produto, ['preco', 'precoDe', 'comboReferenceId']);
        }

    };

    var cart = {
        clear: function() {
            _.each(['tv','internet','fone', 'celular'], function(productType) {
                cart[productType + 'Id'] = data[productType + 'EmptyId'];
            });

            delete cart.comboId;
            delete cart.selection;
            cart.adicionais.clear();

            cart.conditions = _.clone(defaultConditions);
        },

        adicionais: {
            length: 0,
            values: {},
            keys: [],
            permitidos: function() {
                var id, opcoesPermitidas = [];

                _.each(cart.selection, function(produto){
                    _.each(produto.adicionais, function(adicional) {
                        id = _.pluck(adicional.opcoes, ['id']);
                        id = (id).toString().split(',');
                        opcoesPermitidas.push(id);
                    });
                });
                return _.chain(opcoesPermitidas).flatten().uniq().sortBy().value();
            },
            getById: function(additionalId) {
                if ('undefined' === typeof additionalId) { return undefined; }

                return _.chain(cart.selection).map(function(produto) {
                    return _(produto.adicionais).map(function(adicional) {
                        return _(adicional.opcoes).filter(function(opcao) {
                            return (opcao.id).toString() === (additionalId).toString();
                        });
                    });
                }).flatten().compact().first().value();
            },
            add: function(additionalIds) {
                var adicional, additionaisPermitidosIds, values = this.values;
                additionalIds = additionalIds || options.additionalIds;
                if (!additionalIds) { return false; }

                if (!_.isArray(additionalIds)) {
                    additionalIds = !!_.isString(additionalIds) ? additionalIds.split(',') : [(additionalIds).toString()];
                }

                additionaisPermitidosIds = _.intersection(additionalIds,this.permitidos());

                _.each(additionaisPermitidosIds, function(additionalId) {
                    adicional = cart.adicionais.getById(additionalId);
                    values[additionalId] = adicional;
                    if (!adicional.multipleChoice) {
                        cart.adicionais.remove(adicional.otherOptions);
                    }
                });
                this.length = _.size(this.values);
                this.keys = _.keys(this.values);

            },
            remove: function(additionalIds) {
                var adicional, values = this.values;
                additionalIds = additionalIds || options.additionalIds;
                if (!additionalIds) { return false; }

                if (!_.isArray(additionalIds)) {
                    additionalIds = !!_.isString(additionalIds) ? additionalIds.split(',') : [(additionalIds).toString()];
                }

                _.each(additionalIds, function(additionalId) {
                    delete values[additionalId];
                });

                this.length = _.size(this.values);
                this.keys = _.keys(this.values);
            },
            clear: function(productType) {
                if ("undefined" === typeof productType){
                    this.values = {};
                    this.length = 0;
                    this.keys = [];
                } else if (!!cart.selection && !!cart.selection[productType]) {
                    var ids = _.map(cart.selection[productType].adicionais,function(adicional) {
                        id = _.pluck(adicional.opcoes,'id');
                        id = (id).toString();
                        return id;
                    }).toString().split(',');

                    this.remove(_.intersection(this.keys, ids));
                }
            }
        },

        addSelection: function(selectionIds) {
            if (selectionIds.comboId) {
                cart.addCombo(selectionIds.comboId);
            } else {
                _.each(['tv', 'internet', 'fone', 'celular'], function(product) {
                    cart.addProduct(product, selectionIds[product+"Id"]);
                });
            }
        },

        addProduct: function(productType, productId) {
            if (productType !== undefined && productId !== undefined) {
                var selection = cart.selection;

                delete cart.comboId;

                cart[productType + 'Id'] = productId;

                selection = data.getSelection(cart);
                cart.selection = selection;
                cart.adicionais.add();

                if (!!selection && !selection.combo) {
                    _.each(selection, function(product, type) {
                        if (!!product.somenteCombo) {
                            cart.removeProduct(type);
                        }
                    });
                }
            }
        },

        removeProduct : function(productType) {
            cart.adicionais.clear(productType);
            return productType ?
                cart.addProduct(productType, data[productType + 'EmptyId']) : false;
        },

        addCombo : function(comboId) {
            var combo = data.getComboById(comboId);

            if (combo !== undefined) {
                var selectedIds = new SelectIds(privateData.combo[comboId]);
                selectedIds.comboId = comboId;
                _.extend(cart, selectedIds);

                cart.selection = combo;
                cart.adicionais.add();
            }
        },

        removeCombo : function() {
            return cart.clear();
        },

        getMontly : function(selection, options) {
            selection = selection || cart.selection;
            options = options || {};
            var additionals = (!options.ignoreAdditionals) ? cart.getAdditionals() : {preco:0};
            return parseInt(
                (additionals           ? additionals.preco        : 0) +
                (selection.tv          ? selection.tv.preco       : 0) +
                (selection.internet    ? selection.internet.preco : 0) +
                (selection.fone        ? selection.fone.preco     : 0) +
                (selection.celular     ? selection.celular.preco  : 0), 10);
        },

        getMontlyFrom : function(selection, options) {
            selection = selection || cart.selection;
            options = options || {};
            var additionals = (!options.ignoreAdditionals) ? cart.getAdditionals() : {precoDe:0};
            var montlyFrom = parseInt(
                (additionals           ? additionals.precoDe        : 0) +
                (selection.tv          ? selection.tv.precoDe       : 0) +
                (selection.internet    ? selection.internet.precoDe : 0) +
                (selection.fone        ? selection.fone.precoDe     : 0) +
                (selection.celular     ? selection.celular.precoDe  : 0), 10);

            return (montlyFrom !== cart.getMontly(selection) ? montlyFrom : undefined);
        },

        getSignup : function(selection, options) {
            selection = selection || cart.selection;
            options = options || {};
            var additionals = (!options.ignoreAdditionals) ? cart.getAdditionals() : {adesao:0};
            return parseInt(
                (additionals           ? additionals.adesao        : 0) +
                (selection.tv          ? selection.tv.adesao       : 0) +
                (selection.internet    ? selection.internet.adesao : 0) +
                (selection.fone        ? selection.fone.adesao     : 0) +
                (selection.celular     ? selection.celular.adesao  : 0), 10);
        },

        getInstallation : function(selection, options) {
            selection = selection || cart.selection;
            options = options || {};
            var additionals = (!options.ignoreAdditionals) ? cart.getAdditionals() : {taxaInstalacao:0};
            return parseInt(
                (additionals           ? additionals.taxaInstalacao        : 0) +
                (selection.tv          ? selection.tv.taxaInstalacao       : 0) +
                (selection.internet    ? selection.internet.taxaInstalacao : 0) +
                (selection.fone        ? selection.fone.taxaInstalacao     : 0) +
                (selection.celular     ? selection.celular.taxaInstalacao  : 0), 10);
        },

        getAdditionals: function(adicionais) {
            adicionais = adicionais || cart.adicionais.values || {};
            var valores = {
                preco:          0,
                precoDe:        0,
                adesao:         0,
                taxaInstalacao: 0
            };

            _.each(adicionais, function(adicional) {
                valores.preco           += adicional.preco          || 0;
                valores.precoDe         += adicional.precoDe        || 0;
                valores.adesao          += adicional.adesao         || 0;
                valores.taxaInstalacao  += adicional.taxaInstalacao || 0;
            });
            return valores;
        },

        getPeriodos: function (selection, options) {
            selection = selection || cart.selection;
            options = options || {};
            var additionals = (!options.ignoreAdditionals) ? cart.getAdditionals() : {preco:0, precoDe:0, adesao:0, taxaInstalacao:0 };
            var i,
                periodos = [];
                valoresPeriodos = {};

            if (!!selection) {
                for (var mes = 12; mes>=0; mes--) {
                    var preco = 0;

                    if (selection.tv) {
                        preco += selection.tv.periodos && selection.tv.periodos[mes] ? selection.tv.periodos[mes] : selection.tv.preco ;
                    }
                    if (selection.internet) {
                        preco += selection.internet.periodos && selection.internet.periodos[mes] ? selection.internet.periodos[mes] : selection.internet.preco ;
                    }
                    if (selection.fone) {
                        preco += selection.fone.periodos && selection.fone.periodos[mes] ? selection.fone.periodos[mes] : selection.fone.preco ;
                    }
                    if (selection.celular) {
                        preco += selection.celular.periodos && selection.celular.periodos[mes] ? selection.celular.periodos[mes] : selection.celular.preco ;
                    }
                    if (additionals) {
                        preco += additionals.periodos && additionals.periodos[mes] ? additionals.periodos[mes] : additionals.preco ;
                    }

                    valoresPeriodos[mes+1] = preco;
                }
            }

            _.each(valoresPeriodos, function(periodo,mes) {
                obj = {};
                obj.mes = mes;
                obj.atual = periodo;
                obj.anterior = valoresPeriodos[mes-1] || 0;

                if (obj.atual !== obj.anterior) {
                    periodos.push(obj);
                }
            });

            _.each(periodos, function(obj, i) {
                obj.ultimoMes = !!periodos[i+1] ? periodos[i+1].mes - 1  : null;
                obj.ultimoMes = obj.ultimoMes ? obj.ultimoMes.toString() : null;
                periodos[i] = obj;
            });

            return periodos;
        },

        getPrimeiroPeriodo: function(selection) {
            var periodos = cart.getPeriodos(selection),
                primeiroPeriodo = _.first(periodos),
                primeiroPeriodoPreco;

            primeiroPeriodoPreco = (!!primeiroPeriodo) ?
                primeiroPeriodo.atual :
                cart.getMontly(selection);
            return primeiroPeriodoPreco;
        },

        getUltimoPeriodo: function(selection) {
            var periodos = cart.getPeriodos(selection),
                ultimoPeriodo = _.last(periodos),
                ultimoPeriodoPreco;

            ultimoPeriodoPreco = (!!ultimoPeriodo)?
                ultimoPeriodo.atual :
                cart.getMontlyFrom(selection);
            return ultimoPeriodoPreco;
        }
    };

    return this.init();
};
