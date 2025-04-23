<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Csrf\CsrfTokenManagerInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

class TurnCredentialsController extends AbstractController
{
    /**
     * Základní URL pro Metered TURN API s vlastní subdoménou
     */
    private const METERED_TURN_API_URL = 'https://softcode.metered.live/api/v1/turn/credentials';

    public function __construct(
        private string $meteredApiKey,
        private HttpClientInterface $httpClient
    ) {
    }

    #[Route('/api/turn-credentials', name: 'api_turn_credentials', methods: ['GET', 'POST', 'OPTIONS'])]
    public function getTurnCredentials(Request $request): JsonResponse
    {
        // Na začátek metody getTurnCredentials()
        dump('TURN credentials request received: ' . $request->getPathInfo());
        dump('API klíč nastaven: ' . (empty($this->meteredApiKey) ? 'NE' : 'ANO'));

        // Pro OPTIONS požadavky (preflight CORS)
        if ($request->getMethod() === 'OPTIONS') {
            $response = new JsonResponse(null, 204);
            $response->headers->set('Access-Control-Allow-Origin', '*');
            $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            $response->headers->set('Access-Control-Allow-Headers', 'Content-Type');
            return $response;
        }

        try {
            // Přímé volání Metered API bez kontroly autentizace
            $apiUrl = self::METERED_TURN_API_URL . '?apiKey=' . urlencode($this->meteredApiKey);

            $response = $this->httpClient->request('GET', $apiUrl, [
                'timeout' => 5,
                'headers' => [
                    'Accept' => 'application/json'
                ]
            ]);

            if ($response->getStatusCode() === 200) {
                $data = $response->toArray();
                $jsonResponse = $this->json($data);

                // Přidáme CORS hlavičky
                $jsonResponse->headers->set('Access-Control-Allow-Origin', '*');
                $jsonResponse->headers->set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

                return $jsonResponse;
            }

            // Logování pro diagnostiku
            error_log('Metered API vrátilo chybu: ' . $response->getStatusCode() . ' - ' . $response->getContent(false));

            // Vrácení STUN serverů jako fallback
            return $this->getFallbackIceServers();

        } catch (\Exception $e) {
            // Logování pro diagnostiku
            error_log('Výjimka při získávání TURN credentials: ' . $e->getMessage());

            return $this->getFallbackIceServers();
        }
    }

    #[Route('/api/turn-credentials', name: 'api_turn_credentials_post', methods: ['POST'])]
    public function postTurnCredentials(Request $request): JsonResponse
    {
        // Stejná implementace pro POST i GET
        return $this->getMeteredTurnCredentials($request);
    }

    /**
     * Získá dočasné TURN credentials pomocí Metered API
     */
    // V metodě getMeteredTurnCredentials()
    private function getMeteredTurnCredentials(Request $request): JsonResponse
    {
        // Přímé přesměrování na Metered API
        try {
            // Použijeme URL pro Metered TURN API s vlastní subdoménou a API klíčem
            $apiUrl = self::METERED_TURN_API_URL . '?apiKey=' . urlencode($this->meteredApiKey);

            $response = $this->httpClient->request('GET', $apiUrl, [
                'timeout' => 5,
                'headers' => [
                    'Accept' => 'application/json',
                    'User-Agent' => 'VideoChat/1.0 (Symfony)'
                ]
            ]);

            // Pouze vracíme data z Metered API přímo klientovi
            if ($response->getStatusCode() === 200) {
                $data = $response->toArray();
                $jsonResponse = $this->json($data);

                // Nastavíme správné CORS a Cache hlavičky
                $jsonResponse->headers->set('Cache-Control', 'no-cache, no-store, must-revalidate');
                $jsonResponse->headers->set('Access-Control-Allow-Origin', '*');

                return $jsonResponse;
            }
        } catch (\Exception $e) {
            // V případě chyby použijeme záložní přístup
            error_log('Výjimka při získávání TURN credentials: ' . $e->getMessage());
        }

        return $this->getFallbackIceServers();
    }

    /**
     * Záložní ICE servery - pouze veřejné STUN servery
     */
    private function getFallbackIceServers(): JsonResponse
    {
        $response = $this->json([
            [
                'urls' => 'stun:stun.l.google.com:19302'
            ],
            [
                'urls' => 'stun:stun1.l.google.com:19302'
            ],
            [
                'urls' => 'stun:stun2.l.google.com:19302'
            ],
            [
                'urls' => 'stun:stun.relay.metered.ca:80'
            ]
        ]);

        // Přidáme CORS hlavičky
        $response->headers->set('Access-Control-Allow-Origin', '*');
        $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

        return $response;
    }
}