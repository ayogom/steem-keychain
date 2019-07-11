let accounts_json = null,
    mk = null;
let active_account, priceBTC, sbd, steem_p, sp,dtc, priceSBD, priceSteem, votePowerReserveRate, totalSteem, totalVests, rewardBalance, recentClaims, steemPrice, dynamicProp = null;
const STEEMIT_VOTE_REGENERATION_SECONDS = (5 * 60 * 60 * 24);
let custom_created = false;
let manageKey, getPref = false;
let to_autocomplete =[];
//chrome.storage.local.remove("transfer_to");

$("#copied").hide();
$("#witness_votes").hide();

// Ask background if it is unlocked
getMK();

// Check if autolock and set it to background
function sendAutolock(){
  chrome.storage.local.get(['autolock'], function(items) {
      if (items.autolock != undefined) {
          $(".autolock input").prop("checked", false);
          $("#" + JSON.parse(items.autolock).type).prop("checked", true);
          $("#mn").val(JSON.parse(items.autolock).mn);
          setAutolock(items.autolock);
          $("#mn").css('visibility', JSON.parse(items.autolock).type == "idle" ? 'visible' : 'hidden');
      }
  });
}

function checkKeychainify() {
    chrome.storage.local.get(['use_keychainify'], function(items) {
        if (items.use_keychainify !== undefined) {
            $(".enable_keychainify input").prop("checked", items.use_keychainify);
        } else {
            $(".enable_keychainify input").prop("checked", true);
        }
    });
}

// Check if we have mk or if accounts are stored to know if the wallet is locked unlocked or new.
chrome.runtime.onMessage.addListener(function(msg, sender, sendResp) {
    if (msg.command == "sendBackMk") {
        chrome.storage.local.get(['accounts', 'current_rpc'], function(items) {
            steem.api.setOptions({
                url: items.current_rpc || 'https://api.steemit.com'
            });
            if (msg.mk == null || msg.mk == undefined) {
                if (items.accounts == null || items.accounts == undefined) {
                    showRegister();
                } else {
                    showUnlock();
                }
            } else {
                mk = msg.mk;
                initializeMainMenu();
            }
        });
    }
});

// Save autolock
$(".autolock").click(function() {
    $(".autolock input").prop("checked", false);
    $(this).find("input").prop("checked", "true");
    $("#mn").css('visibility', $(this).find("input").attr("id") == "idle" ? 'visible' : 'hidden');
});

// Save enable_keychainify
$(".enable_keychainify").click(function() {
    const enable_keychainify = $(this).find("input").prop("checked");
    $(this).find("input").prop("checked", !enable_keychainify);
    chrome.storage.local.set({
        use_keychainify: !enable_keychainify
    });
});

// Saving autolock options
$("#save_autolock").click(function() {
    const autolock = JSON.stringify({
        "type": $(".autolock input:checkbox:checked").eq(0).attr("id") || "default",
        "mn": $("#mn").val() || 10
    });
    chrome.storage.local.set({
        autolock: autolock
    });
    setAutolock(autolock);
    initializeMainMenu();
});

// Lock the wallet and destroy traces of the mk
$("#lock").click(function() {
    chrome.runtime.sendMessage({
        command: "sendMk",
        mk: null
    }, function(response) {});
    if (accounts_json == null) {
        accounts_json = {
            list: []
        };
        chrome.storage.local.set({
            accounts: encryptJson(accounts_json, mk)
        });
    }
    $("#back_forgot_settings").attr("id", "back_forgot");
    mk = null;
    showUnlock();
});

// Unlock with masterkey and show the main menu
$("#submit_unlock").click(function() {
    chrome.storage.local.get(['accounts'], function(items) {
        const pwd = $("#unlock_pwd").val();
        if (decryptToJson(items.accounts, pwd) != null) {
            mk = pwd;
            chrome.runtime.sendMessage({
                command: "sendMk",
                mk: mk
            }, function(response) {});
            $(".error_div").html("");
            $(".error_div").hide();
            $("#unlock_pwd").val("");
            initializeMainMenu();
        } else {
            showError("Wrong password!");
        }
    });
});

// If user forgot Mk, he can reset the wallet
$("#forgot_div button").click(function() {
    chrome.storage.local.clear(function() {
        accounts_json = null;
        mk = null;
        $("#forgot_div").hide();
        $("#register").show();
    });
});

// Registration confirmation
$("#submit_master_pwd").click(function() {
    if (acceptMP($("#master_pwd").val())) {
        if ($("#master_pwd").val() == $("#confirm_master_pwd").val()) {
            mk = $("#master_pwd").val();
            chrome.runtime.sendMessage({
                command: "sendMk",
                mk: mk
            }, function(response) {});
            initializeMainMenu();
            $(".error_div").hide();
        } else {
            showError("Your passwords do not match!");
        }
    } else {
        showError("Your password must be at least 8 characters long and include a lowercase letter, an uppercase letter and a digit or be at least 16 characters long without restriction.");
    }
});
function acceptMP(mp){
  return mp.length>=16||(mp.length>=8&&mp.match(/.*[a-z].*/)&&mp.match(/.*[A-Z].*/)&&mp.match(/.*[0-9].*/));
}
// Set visibilities back to normal when coming back to main menu
function initializeMainMenu() {
    sendAutolock();
    checkKeychainify();
    initializeVisibility();
    manageKey = false;
    getPref = false;
    chrome.storage.local.get(['accounts', 'last_account', 'rpc', 'current_rpc','transfer_to'], function(items) {
        to_autocomplete=(items.transfer_to?JSON.parse(items.transfer_to):{});
        accounts_json = (items.accounts == undefined || items.accounts == {
            list: []
        }) ? null : decryptToJson(items.accounts, mk);
        loadRPC(items.rpc, items.current_rpc);
        if (accounts_json != null && accounts_json.list.length != 0) {
            $("#accounts").empty();
            $("#main").show();

            // Add the last account selected to the front of the account list.
            if (items.last_account) {
              let last=null;
              if(items.last_account.includes("(DTC)"))
                last=accounts_json.list.find(elt => elt.name == items.last_account.split(" ")[0]&&elt.type==="dTube");
              else
                last = accounts_json.list.find(elt => elt.name == items.last_account&&!elt.type);

                if (last) {
                    accounts_json.list.splice(accounts_json.list.indexOf(last), 1);
                    accounts_json.list.unshift(last);
                }
            }
            $(".usernames").html("<select></select>");
            for (account of accounts_json.list) {
              console.log(account);
                $(".usernames select").append("<option>" + account.name +(account.type=="dTube"?" (DTC)":"") +"</option>");
            }
            $(".usernames select").eq(0).append("<option name='add_account'>Add New Account</option>");
            $(".usernames select").eq(0).append("<option name='add_account_dtube'>Add dTube Account</option>");
            initiateCustomSelect();
        } else {
            $("#main").hide();
            $("#add_account_div").show();
            $("#add_account_div .back_enabled").addClass("back_disabled");
        }
    });
}
// Show Confirmation window before transfer
$("#send_transfer").click(function() {
    confirmTransfer();
});

function confirmTransfer(){
  $("#confirm_send_div").show();
  $("#send_div").hide();
  const to = $("#recipient").val();
  const amount = $("#amt_send").val();
  const currency = $("#currency_send .select-selected").html();
  let memo = $("#memo_send").val();
  $("#from_conf_transfer").text("@"+active_account.name)
  $("#to_conf_transfer").text("@"+to);
  $("#amt_conf_transfer").text(amount+" "+currency);
  $("#memo_conf_transfer").text((memo==""?"Empty":memo)+((memo!=""&&$("#encrypt_memo").prop("checked"))?" (encrypted)":""));
}

// Show Confirmation window before transfer DTC
$("#send_transfer_dtube").click(function() {
    confirmDTubeTransfer();
});

function confirmDTubeTransfer(){
  $("#confirm_send_dtube_div").show();
  $("#send_dtube_div").hide();
  const to = $("#recipient_dtube").val();
  const amount = $("#amt_send_dtube").val();
  const memo = $("#memo_send_dtube").val();
  $("#from_conf_transfer_dtube").text("@"+active_account.name)
  $("#to_conf_transfer_dtube").text("@"+to);
  $("#amt_conf_transfer_dtube").text(amount+" DTC");
  $("#memo_conf_transfer_dtube").text(memo==""?"Empty":memo);
}

// Send STEEM or SBD to an user
$("#confirm_send_transfer").click(function() {
    showLoader();
    sendTransfer();
});

// Send STEEM or SBD to an user
$("#confirm_send_transfer_dtube").click(function() {
    showLoader();
    sendTransferDTube();
});

// Send a transfer
async function sendTransferDTube() {
  const to = $("#recipient_dtube").val();
  const amount = $("#amt_send_dtube").val();
  let memo = $("#memo_send_dtube").val();
  if (to != "" && amount != "" && amount >= 0.01) {
      const transfer=await dTubeTransferRawAsync(active_account.keys.private, active_account.name, to, parseInt(amount*100), memo);
          $("#send_loader").hide();
          $("#confirm_send_transfer").show();
          if (transfer) {
              javalon.getAccount(active_account.name,function(err,sender){
                dtc = sender.balance/100;
                $("#confirm_send_dtube_div").hide();
                $("#send_dtube_div").show();
                $(".error_div").hide();
                $(".success_div").html("Transfer successful!").show();
                chrome.storage.local.get({'transfer_to':JSON.stringify({})}, function(items) {
                  let transfer_to=JSON.parse(items.transfer_to);
                  const name=active_account.name+"_dtube";
                  if(!transfer_to[name])transfer_to[name]=[];
                  console.log(transfer_to);
                  if(transfer_to[name].filter((elt)=>{return elt==to}).length==0)
                    transfer_to[name].push(to);
                    console.log(transfer_to);

                  console.log(JSON.stringify(transfer_to));
                  chrome.storage.local.set({
                      transfer_to: JSON.stringify(transfer_to)
                  });
                });
                setTimeout(function() {
                    $(".success_div").hide();
                }, 5000);
              });
          } else {
              $(".success_div").hide();
              showError("Something went wrong! Please try again!");
          }
          $("#send_transfer").show();
  } else {
      showError("Please fill the fields!");
      $("#send_loader").hide();
      $("#send_transfer").show();
  }
}


// Vote for witnesses
function voteFor(name) {
    if (active_account.keys.hasOwnProperty("active")) {
        $('#' + name + ' img').attr('src', '../images/loading.gif');

        steem.broadcast.accountWitnessVote(active_account.keys.active, active_account.name, name, true, function(err, result) {
            if (err == null) {
                setTimeout(function() {
                    if ($(".witness_container:visible").length == 0)
                        $("#witness_votes").animate({
                            opacity: 0
                        }, 500, function() {
                            $("#witness_votes").hide();
                        });
                }, 1000);

                $('#' + name + ' img').attr('src', '../images/icon_witness-vote.svg');
            }
        });
    } else {
        $("#witness_votes").hide();
        $("#main").hide();
        $("#add_key_div").show();
        manageKey = true;
        manageKeys($(".usernames .select-selected").eq(0).html());
        showError("Please enter your active key to vote for witnesses!");
    }
}

// Send a transfer
async function sendTransfer() {
    const to = $("#recipient").val();
    const amount = $("#amt_send").val();
    const currency = $("#currency_send .select-selected").html();
    let memo = $("#memo_send").val();
    if (memo != "" && $("#encrypt_memo").prop("checked")) {
        try {
            const receiver = await steem.api.getAccountsAsync([to]);
            const memoReceiver = receiver["0"].memo_key;
            memo = window.encodeMemo(active_account.keys.memo, memoReceiver, "#" + memo);
        } catch (e) {
            console.log(e);
        }
    }
    if (to != "" && amount != "" && amount >= 0.001) {
        steem.broadcast.transfer(active_account.keys.active, active_account.name, to, parseFloat(amount).toFixed(3) + " " + currency, memo, async function(err, result) {
            $("#send_loader").hide();
            $("#confirm_send_transfer").show();
            if (err == null) {
                const sender = await steem.api.getAccountsAsync([active_account.name]);
                sbd = sender["0"].sbd_balance.replace("SBD", "");
                steem_p = sender["0"].balance.replace("STEEM", "");
                $("#confirm_send_div").hide();
                $("#send_div").show();
                if (currency == "SBD") {
                    $(".transfer_balance div").eq(1).html(numberWithCommas(sbd));
                } else if (currency == "STEEM") {
                    $(".transfer_balance div").eq(1).html(numberWithCommas(steem_p));
                }
                $(".error_div").hide();
                $(".success_div").html("Transfer successful!").show();
                chrome.storage.local.get({'transfer_to':JSON.stringify({})}, function(items) {
                  let transfer_to=JSON.parse(items.transfer_to);
                  if(!transfer_to[active_account.name])transfer_to[active_account.name]=[];
                  console.log(transfer_to);
                  if(transfer_to[active_account.name].filter((elt)=>{return elt==to}).length==0)
                    transfer_to[active_account.name].push(to);
                    console.log(transfer_to);

                  console.log(JSON.stringify(transfer_to));
                  chrome.storage.local.set({
                      transfer_to: JSON.stringify(transfer_to)
                  });
                });
                setTimeout(function() {
                    $(".success_div").hide();
                }, 5000);
            } else {
                $(".success_div").hide();
                showError("Something went wrong! Please try again!");
            }
            $("#send_transfer").show();
        });
    } else {
        showError("Please fill the fields!");
        $("#send_loader").hide();
        $("#send_transfer").show();
    }
}
