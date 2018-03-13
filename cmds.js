const Sequelize = require('sequelize');


const {models} = require('./model');


const {log, biglog, errorlog, colorize} = require("./out");



exports.helpCmd = rl => {
    log("Comandos:");
    log("   h|help - Muestra esta ayuda.");
    log("   list - Listar los quizzes existentes.");
    log("   show <id> - Muestra la pregunta y la respuesta el quiz indicado.");
    log("   add - Añadir un nuevo quiz interactivamente.");
    log("   delete <id> - Borrar el quiz indicado.");
    log("   edit <id> - Editar el quiz indicado.");
    log("   test <id> - Probar el quiz indicado.");
    log("   p|play - Jugar a preguntar aleatoriamente todos los quizzes.");
    log("   credits - Créditos.");
    log("   q|quit - Salir del programa.");
    rl.prompt();
};

const makeQuestion = (rl, text)=> {
    return new Sequelize.Promise((resolve,reject) => {
        rl.question(colorize(text,'red'), answer => {
            resolve(answer.trim());
        });
    });
};

exports.addCmd = rl => {
    makeQuestion(rl,'Introduzca una pregunta: ')
        .then(q => {
            return makeQuestion(rl, 'Introduzca la respuesta: ')
                .then(a => {
                    return {question : q, answer: a}
                });
        })
        .then(quiz => {
            return models.quiz.create(quiz);
        })
        .then((quiz) => {
            log(`  ${colorize('Se ha añadido', 'magenta')}: ${quiz.question} ${colorize('=>', 'magenta')} ${quiz.answer}`);
        })
        .catch(Sequelize.ValidationError, error => {
            errorlog('El quiz es erroneo:');
            error.errors.forEach(({message}) => errorlog(message));
        })
        .catch(error=> {
            errorlog(error.message);
        })
        .then(()=>{
            rl.prompt();
        });
};

/**
 *Lista todos los quizzes existentes en el modelo.
 */
exports.listCmd = rl => {
    models.quiz.findAll()
        .each(quiz=> {
            log(` [${colorize(quiz.id,'magenta')}]: ${quiz.question}`);
        })
        .catch(error => {
            errorlog(error.messsage);
        })
        .then(()=> {
            rl.prompt();
        });
};


const validateId = id => {
    return new Sequelize.Promise((resolve, reject) => {
        if(typeof id== "undefined") {
            reject(new Error(`Falta el parametro <id>.`));
        }else {
            id = parseInt(id);
            if(Number.isNaN(id)){
                reject(new Error(`El valor del parametro <id> no es un numero.`));
            }else{
                resolve(id);
            }
        }
    });
};


/**
 * Muestra la pregunta y la respuesta del quiz indicado.
 */
exports.showCmd = (rl,id) => {
    validateId(id)
        .then(id => models.quiz.findById(id))
        .then(quiz => {
            if(!quiz){
                throw new Error(`No existe un quiz asociado al id= ${id}.`);
            }
            log(`[${colorize(quiz.id,'magenta')}]: ${quiz.question} ${colorize('=>','magenta')} ${quiz.answer}`);
        })
        .catch(error => {
            errorlog(error.message);
        })
        .then(() => {
            rl.prompt();
        });
};


exports.testCmd = (rl, id) => {

    if(typeof id === "undefined") {
        errorlog(`Falta el parámetro id.`);
        rl.prompt();
    }else {
        validateId(id)
            .then(id => models.quiz.findById(id))
            .then(quiz => {
                if (!quiz) {
                    throw new Error(`No existe la pregunta asociada al id= ${id}.`);
                }
                return makeQuestion(rl, `${quiz.question} : `)
                    .then(q => {
                        var respuestaCorrecta = RegExp(quiz.answer, 'i');
                        const arrayRespuesta = q.match(respuestaCorrecta);
                        if (arrayRespuesta == null) {
                            console.log("Su respuesta es : ");
                            log("Incorrecta", 'red');
                        } else if (arrayRespuesta[0].replace(respuestaCorrecta, quiz.answer).trim() == quiz.answer) {
                            console.log("Su respuesta es : ");
                            log("Correcta", 'green');
                        } else {
                            console.log("Su respuesta es : ");
                            log("Incorrecta", 'red');
                        }
                        rl.prompt();
                    });
            })
            .catch(Sequelize.ValidationError, error => {
                error.log('Respuesta erronea');
                error.errors.forEach(({message}) => errorlog(message));
            })
            .catch(error => {
                errorlog(error.message);
            })
            .then(() => {
                rl.prompt();
            });
    }
};




exports.playCmd = rl => {
    let score = 0;
    let alreadyAsked = [];

const playloop = () => {
      const whereOpt = {'id' : {[Sequelize.Op.notIn]:alreadyAsked}};
      return models.quiz.count({where: whereOpt})
          .then(function (count) {
          return models.quiz.findAll({
                  where: whereOpt,
                  offset: Math.floor(Math.random() * count),
                  limit: 1
          });
          })
          .then(quizzes => quizzes[0])
          .then(quiz => {
              if(!quiz) {
                  log('No hay nada más que preguntar. ');
                  log('Fin del juego.');
                  rl.prompt();
                  return;
              }


              alreadyAsked.push(quiz.id);

              return makeQuestion(rl, `${quiz.question} ? `)
                  .then(a => {
                      if(a.toLowerCase().trim() === quiz.answer.toLowerCase().trim()){
                          log(`CORRECTO - Lleva ${++score} aciertos`);
                          playloop();
                      }else{
                          log(`INCORRECTO. `);
                          log(`Fin del juego. Aciertos:  ${score} `);
                          rl.prompt();
                      }
                  });
          })
          .catch(error => {
              errorlog(error.message);
          });
};
playloop();
};






/**
 * Borra el quiz indicado.
 */
exports.deleteCmd = (rl,id) => {
    validateId(id)
        .then(id => models.quiz.destroy({where: {id}}))
        .catch(error => {
            errorlog(error.message);
        })
        .then(()=> {
            rl.prompt();
        });
};


/**
 * Edita el quiz indicado.
 */
exports.editCmd = (rl,id) => {
    validateId(id)
        .then(id => models.quiz.findById(id))
        .then(quiz => {
            if(!quiz){
                throw new Error(`No existe el quiz asociado al id= ${id}.`);
            }

            process.stdout.isTTY && setTimeout(() => {rl.write(quiz.question)}, 0);
            return makeQuestion(rl, ' Introduzca la pregunta: ')
                .then(q => {
                    process.stdout.isTTY && setTimeout(()=> {rl.write(quiz.answer)},0);
                    return makeQuestion(rl, ' Introduzca la respuesta: ')
                        .then(a => {
                            quiz.question = q;
                            quiz.answer = a;
                            return quiz;
                        });
                });
        })
        .then(quiz => {
            return quiz.save();
        })
        .then(quiz => {
            log(`   Se ha cambiado el quiz ${colorize(quiz.id, 'magenta')} por: ${quiz.question} ${colorize('=>','magenta')} ${quiz.answer}`);
        })
        .catch(Sequelize.ValidationError, error => {
            error.log('El quiz es erroneo:');
            error.errors.forEach(({message})=>errorlog(message));
        })
        .catch(error =>{
            errorlog(error.message);
        })
        .then(() => {
            rl.prompt();
        });
};

exports.creditsCmd = rl => {
    log('Autor de la práctica:');
    log('Alonso Espasandín Hernán', 'green');
    rl.prompt();
};

exports.quitCmd = rl => {
    rl.close();
};
