const Joi = require('joi');

const schema = Joi.object({
  iexecOut: Joi.string().required(),
  chatId: Joi.string().required(),
  telegramContent: Joi.string().required(),
  telegramContentEncryptionKey: Joi.string().base64(),
  botToken: Joi.string().required(),
});

function validateInputs(envVars) {
  const { error, value } = schema.validate(envVars, { abortEarly: false });
  if (error) {
    const validationErrors = error.details.map((detail) => detail.message);
    throw new Error(validationErrors.join('; '));
  }
  return value;
}

module.exports = validateInputs;
