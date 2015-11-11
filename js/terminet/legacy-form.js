/* A very, very ugly file with a lot of legacy functions. Something we call 'gambiarras' */
var LegacyForm = function(selection) {
    selection = selection || {};
    
    /* ofertas + vantagens */
    var productOfertas = [],
        productVantagens = [];
    
    _.each(['tv','internet','fone', 'celular'], function(product) {
        if(selection[product]) {
            if (selection[product].oferta)    { productOfertas.push('<b>OFERTA ' + product.toUpperCase() + '</b><br>' + utils.stripTags(selection[product].oferta) +'<br><br>'); }
            if (selection[product].vantagens) { productVantagens.push('<b>VANTAGEM ' + product.toUpperCase() + '</b><br>' + utils.stripTags(selection[product].vantagens) +'<br><br>'); }
        }
    });
    
    /* features */
    var tagsCombo = selection.combo && selection.combo.tags ? selection.combo.tags : [],
        tagsTV = selection.tv && selection.tv.tags ? selection.tv.tags : [],
        tagsInternet = selection.internet && selection.internet.tags ? selection.internet.tags : [],
        tagsFone = selection.fone && selection.fone.tags ? selection.fone.tags : [],
        tagsAll = _.union(tagsCombo, tagsTV, tagsInternet, tagsFone);
        
    /* agendamento */
    var agendaInstalacao = function(agendaInstalacao) { return agendaInstalacao ? _.reduce(agendaInstalacao, function(memo, num){ return parseInt(memo,10) + parseInt(num, 10); }, 0) : 0; }
    
    /* adicionais */
    var getAdicionaisSelecionados = function(cart) {  /* legacy (a.k.a untouched function) */
        var adicionais = {};
        _.each(cart.adicionais_selecionados, function(adicional, productType) {
            var product = cart.selection[productType];
            adicionais[productType] = {};
            _.each(adicional, function(opcaoAdicional, adicionalTipo) {
                var tmpAdicional = product.adicionais[adicionalTipo],
                    tmpAdicionalOpcoes;
                if (!!tmpAdicional) {
                    tmpAdicionalOpcoes = tmpAdicional.opcoes[opcaoAdicional];
                    if (!!tmpAdicionalOpcoes) {
                        adicionais[productType][tmpAdicional.nome] = [tmpAdicionalOpcoes.nome]
                    }
                }
            })
        });
        return JSON.stringify(adicionais)
    };
    
    var submit = function(callback, errorCallback){
        var userForm = $("#userForm").serialize();
        
        //console.log(unescape(userForm)); //dbg
        //return callback({}); //dbg
        
        $.ajax({
            url: tn.mindLeadsPath + "convert",
            data: userForm,
            dataType: "jsonp",
            type: "GET",
            scriptCharset: "utf-8",
            jsonpCallback: "parseResponse",
            contentType: "application/x-www-form-urlencoded; charset=utf-8",
            beforeSend: function(xhr) {
                xhr.setRequestHeader("Accept", "application/x-www-form-urlencoded; charset=utf-8")
            },
            success: function(data) {
               if (typeof callback == "function") {
                    callback(data);
                }
            },
            error: function(jqXHR, textStatus, errorThrown) {
                if (typeof errorCallback == "function") {
                    errorCallback(jqXHR, textStatus, errorThrown);
                }
            }
        })
    };
    
    return {
        productOfertas : productOfertas.join("") + productVantagens.join(""),
        tagsAll : tagsAll,
        agendaInstalacao : agendaInstalacao,
        getAdicionaisSelecionados : getAdicionaisSelecionados,
        submit : submit
    }
}