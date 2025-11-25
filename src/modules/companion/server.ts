import Io from '@/helpers/io';
import Logger from '@/helpers/logger';
import Settings from '@/helpers/settings';
import { createServer, Server as HttpServer } from 'http';
import { l10n } from 'vscode';
import { Handler } from './handler';
import { Submitter } from './submitter';

export class Server {
    private static logger: Logger = new Logger('companion-server');
    private static server: HttpServer;

    public static init() {
        Server.logger.trace('init');
        Server.server = createServer((request, response) => {
            let requestData = '';

            request.on('data', (chunk) => {
                requestData += chunk;
            });
            request.on('close', async () => {
                Server.logger.debug('Received request', requestData);
                if (request.url === '/') {
                    if (requestData.trim() === '') {
                        Server.logger.warn('Empty request data, ignoring');
                    } else {
                        try {
                            await Handler.handleIncomingProblem(
                                JSON.parse(requestData),
                            );
                        } catch (e) {
                            this.logger.error('Error parsing request data', e);
                            if (e instanceof SyntaxError) {
                                Io.warn(
                                    l10n.t('Companion data is invalid JSON'),
                                );
                            } else {
                                Io.warn(
                                    l10n.t(
                                        'Error occurred while processing companion data',
                                    ),
                                );
                            }
                        }
                    }
                    response.statusCode = 200;
                } else if (request.url === '/getSubmit') {
                    response.statusCode = 200;
                    response.write(
                        JSON.stringify(await Submitter.processSubmit()),
                    );
                } else {
                    response.statusCode = 404;
                }
                response.end(() => {
                    if (request.url === '/getSubmit') {
                        Submitter.resolvePendingSubmit();
                    }
                });
            });
        });

        Server.server.on('error', (e) => {
            Server.logger.error('Server error occurred', e);
            Io.error(
                l10n.t('Failed to start companion server: {msg}.', {
                    msg: e.message,
                }),
            );
        });

        Server.logger.info(
            'Companion server listen at port',
            Settings.companion.listenPort,
        );
        Server.server.listen(Settings.companion.listenPort);
    }

    public static stopServer() {
        Server.logger.trace('stopServer');
        Server.server.close();
        Handler.clearBatches();
    }
}
