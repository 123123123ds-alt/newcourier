import axios, { AxiosInstance } from 'axios';
import { parseStringPromise } from 'xml2js';

const SOAP_NAMESPACE = 'http://tempuri.org/';

export class EccangClient {
  private readonly http: AxiosInstance;
  private readonly endpoint: string;

  constructor(
    baseUrl: string,
    private readonly appToken: string,
    private readonly appKey: string
  ) {
    this.endpoint = `${this.normalizeBaseUrl(baseUrl)}/default/svc/web-service`;
    this.http = axios.create({
      headers: {
        'Content-Type': 'application/xml',
        SOAPAction: `${SOAP_NAMESPACE}callService`
      },
      timeout: 20000
    });
  }

  buildEnvelope(service: string, params: unknown): string {
    const json = JSON.stringify(params ?? {});

    return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <callService xmlns="${SOAP_NAMESPACE}">
      <paramsJson><![CDATA[${json}]]></paramsJson>
      <appToken>${this.escapeXml(this.appToken)}</appToken>
      <appKey>${this.escapeXml(this.appKey)}</appKey>
      <service>${this.escapeXml(service)}</service>
    </callService>
  </soap:Body>
</soap:Envelope>`;
  }

  async call<T>(service: string, params: unknown): Promise<T> {
    const payload = this.buildEnvelope(service, params);
    const response = await this.http.post<string>(this.endpoint, payload);
    return this.parseResponse<T>(response.data);
  }

  private async parseResponse<T>(xml: string): Promise<T> {
    const parsed = await parseStringPromise(xml, {
      explicitArray: false,
      trim: true,
      ignoreAttrs: false
    });

    const envelope =
      parsed['soap:Envelope'] ?? parsed.Envelope ?? parsed['SOAP-ENV:Envelope'];
    const body =
      envelope?.['soap:Body'] ?? envelope?.Body ?? envelope?.['SOAP-ENV:Body'];
    const responseNode =
      body?.callServiceResponse ??
      body?.['ns1:callServiceResponse'] ??
      body?.['ns2:callServiceResponse'] ??
      body?.['soap:callServiceResponse'] ??
      body?.response;

    const result =
      responseNode?.return ??
      responseNode?.CallServiceResult ??
      responseNode?.response ??
      responseNode;

    if (typeof result === 'string') {
      return JSON.parse(result) as T;
    }

    if (result && typeof result === 'object') {
      return result as T;
    }

    throw new Error('Unexpected ECCANG response payload');
  }

  private normalizeBaseUrl(baseUrl: string): string {
    return baseUrl.replace(/\/$/, '');
  }

  private escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
