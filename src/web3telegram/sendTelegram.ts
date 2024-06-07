import { Buffer } from 'buffer';
import {
  MAX_DESIRED_APP_ORDER_PRICE,
  MAX_DESIRED_DATA_ORDER_PRICE,
  MAX_DESIRED_WORKERPOOL_ORDER_PRICE,
  PROD_WORKERPOOL_ADDRESS,
} from '../config/config.js';
import { WorkflowError } from '../utils/errors.js';
import { generateSecureUniqueId } from '../utils/generateUniqueId.js';
import * as ipfs from '../utils/ipfs-service.js';
import { checkProtectedDataValidity } from '../utils/subgraphQuery.js';
import {
  addressOrEnsSchema,
  addressSchema,
  telegramContentSchema, //todo  : telegram content schema? ok
  positiveNumberSchema,
  labelSchema,
  throwIfMissing,
} from '../utils/validators.js';
import {
  DappAddressConsumer,
  DappWhitelistAddressConsumer,
  IExecConsumer,
  IpfsGatewayConfigConsumer,
  IpfsNodeConfigConsumer,
  SendTelegramParams, //todo "" ok
  SendTelegramResponse, // todo c'est quoi ok
  SubgraphConsumer,
} from './types.js';

export const sendTelegram = async ({
  graphQLClient = throwIfMissing(),
  iexec = throwIfMissing(),
  workerpoolAddressOrEns = PROD_WORKERPOOL_ADDRESS,
  dappAddressOrENS,
  dappWhitelistAddress,
  ipfsNode,
  ipfsGateway,
  telegramContent, // contenu du msg ?
  label,
  dataMaxPrice = MAX_DESIRED_DATA_ORDER_PRICE,
  appMaxPrice = MAX_DESIRED_APP_ORDER_PRICE,
  workerpoolMaxPrice = MAX_DESIRED_WORKERPOOL_ORDER_PRICE,
  protectedData, // le chatid donc ?
}: IExecConsumer &
  SubgraphConsumer &
  DappAddressConsumer &
  DappWhitelistAddressConsumer &
  IpfsNodeConfigConsumer &
  IpfsGatewayConfigConsumer &
  SendTelegramParams): Promise<SendTelegramResponse> => {
  try {
    const vDatasetAddress = addressOrEnsSchema()
      .required()
      .label('protectedData')
      .validateSync(protectedData);
    const vTelegramContent = telegramContentSchema() //todo : content msg telegram ok?
      .required()
      .label('telegramContent')
      .validateSync(telegramContent);
    const vLabel = labelSchema().label('label').validateSync(label);
    const vWorkerpoolAddressOrEns = addressOrEnsSchema()
      .required()
      .label('WorkerpoolAddressOrEns')
      .validateSync(workerpoolAddressOrEns);
    const vDappAddressOrENS = addressOrEnsSchema()
      .required()
      .label('dappAddressOrENS')
      .validateSync(dappAddressOrENS);
    const vDappWhitelistAddress = addressSchema()
      .required()
      .label('dappWhitelistAddress')
      .validateSync(dappWhitelistAddress);
    const vDataMaxPrice = positiveNumberSchema()
      .label('dataMaxPrice')
      .validateSync(dataMaxPrice);
    const vAppMaxPrice = positiveNumberSchema()
      .label('appMaxPrice')
      .validateSync(appMaxPrice);
    const vWorkerpoolMaxPrice = positiveNumberSchema()
      .label('workerpoolMaxPrice')
      .validateSync(workerpoolMaxPrice);

    // Check protected data validity through subgraph
    const isValidProtectedData = await checkProtectedDataValidity(
      graphQLClient,
      vDatasetAddress
    );
    if (!isValidProtectedData) {
      throw new Error('ProtectedData is not valid : missing telegram field');
    }

    const requesterAddress = await iexec.wallet.getAddress();

    // Initialize IPFS storage if not already initialized
    const isIpfsStorageInitialized =
      await iexec.storage.checkStorageTokenExists(requesterAddress);
    if (!isIpfsStorageInitialized) {
      const token = await iexec.storage.defaultStorageLogin();
      await iexec.storage.pushStorageToken(token);
    }

    const [
      datasetorderForApp,
      datasetorderForWhitelist,
      apporder,
      workerpoolorder,
    ] = await Promise.all([
      // Fetch dataset order for web3telegram app
      iexec.orderbook
        .fetchDatasetOrderbook(vDatasetAddress, {
          app: dappAddressOrENS,
          requester: requesterAddress,
        })
        .then((datasetOrderbook) => {
          const desiredPriceDataOrderbook = datasetOrderbook.orders.filter(
            (order) => order.order.datasetprice <= vDataMaxPrice
          );
          return desiredPriceDataOrderbook[0]?.order; // may be undefined
        }),
      // Fetch dataset order for web3telegram whitelist
      iexec.orderbook
        .fetchDatasetOrderbook(vDatasetAddress, {
          app: vDappWhitelistAddress,
          requester: requesterAddress,
        })
        .then((datasetOrderbook) => {
          const desiredPriceDataOrderbook = datasetOrderbook.orders.filter(
            (order) => order.order.datasetprice <= vDataMaxPrice
          );
          return desiredPriceDataOrderbook[0]?.order; // may be undefined
        }),
      // Fetch app order
      iexec.orderbook
        .fetchAppOrderbook(dappAddressOrENS, {
          minTag: ['tee', 'scone'],
          maxTag: ['tee', 'scone'],
          workerpool: workerpoolAddressOrEns,
        })
        .then((appOrderbook) => {
          const desiredPriceAppOrderbook = appOrderbook.orders.filter(
            (order) => order.order.appprice <= vAppMaxPrice
          );
          const desiredPriceAppOrder = desiredPriceAppOrderbook[0]?.order;
          console.log(appOrderbook);
          console.log(desiredPriceAppOrder);
          if (!desiredPriceAppOrder) {
            throw new Error('No App order found for the desired price');
          }
          return desiredPriceAppOrder;
        }),
      // Fetch workerpool order
      iexec.orderbook
        .fetchWorkerpoolOrderbook({
          workerpool: workerpoolAddressOrEns,
          app: dappAddressOrENS,
          dataset: vDatasetAddress,
          minTag: ['tee', 'scone'],
          maxTag: ['tee', 'scone'],
          category: 0,
        })
        .then((workerpoolOrderbook) => {
          const desiredPriceWorkerpoolOrderbook =
            workerpoolOrderbook.orders.filter(
              (order) => order.order.workerpoolprice <= vWorkerpoolMaxPrice
            );
          const randomIndex = Math.floor(
            Math.random() * desiredPriceWorkerpoolOrderbook.length
          );
          const desiredPriceWorkerpoolOrder =
            desiredPriceWorkerpoolOrderbook[randomIndex]?.order;
          if (!desiredPriceWorkerpoolOrder) {
            throw new Error('No Workerpool order found for the desired price');
          }
          return desiredPriceWorkerpoolOrder;
        }),
    ]);

    const datasetorder = datasetorderForApp || datasetorderForWhitelist;
    if (!datasetorder) {
      throw new Error('No Dataset order found for the desired price');
    }

    // Push requester secrets
    const requesterSecretId = generateSecureUniqueId(16);
    const telegramContentEncryptionKey = iexec.dataset.generateEncryptionKey(); //todo : a utiliser pour encrypter le msg ! ok?
    const encryptedFile = await iexec.dataset
      .encrypt(
        Buffer.from(vTelegramContent, 'utf8'),
        telegramContentEncryptionKey
      )
      .catch((e) => {
        throw new WorkflowError('Failed to encrypt telegram content', e);
      });
    const cid = await ipfs
      .add(encryptedFile, {
        ipfsNode: ipfsNode,
        ipfsGateway: ipfsGateway,
      })
      .catch((e) => {
        throw new WorkflowError(
          'Failed to upload encrypted telegram content',
          e
        );
      });
    const multiaddr = `/ipfs/${cid}`;

    await iexec.secrets.pushRequesterSecret(
      //push la clef d'encr dans SMS pour permettre à la dapp d'y acceder ensuite
      requesterSecretId,
      JSON.stringify({
        telegramContentMultiAddr: multiaddr,
        telegramContentEncryptionKey,
      })
    );

    const requestorderToSign = await iexec.order.createRequestorder({
      app: vDappAddressOrENS,
      category: workerpoolorder.category,
      dataset: vDatasetAddress,
      datasetmaxprice: datasetorder.datasetprice,
      appmaxprice: apporder.appprice,
      workerpoolmaxprice: workerpoolorder.workerpoolprice,
      tag: ['tee', 'scone'],
      workerpool: vWorkerpoolAddressOrEns,
      params: {
        iexec_developer_logger: true,
        iexec_secrets: {
          1: requesterSecretId,
        },
        iexec_args: vLabel,
      },
    });
    const requestorder = await iexec.order.signRequestorder(requestorderToSign);

    // Match orders and compute task ID
    const { dealid } = await iexec.order.matchOrders({
      apporder: apporder,
      datasetorder: datasetorder,
      workerpoolorder: workerpoolorder,
      requestorder: requestorder,
    });
    const taskId = await iexec.deal.computeTaskId(dealid, 0); //todo : observable  cf iexec.task.obsTask

    return {
      taskId,
    };
  } catch (error) {
    throw new WorkflowError(`${error.message}`, error);
  }
};
