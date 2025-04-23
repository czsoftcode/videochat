<?php

namespace App\Controller\Security;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Authentication\AuthenticationUtils;

class LoginController extends AbstractController
{
    #[Route('/login', name: 'app_login')]
    public function index(AuthenticationUtils $authenticationUtils): Response
    {
        // If already logged in, redirect to home
        if ($this->getUser()) {
            // Explicitně uložit session, aby se zajistilo, že uživatel je správně přihlášen
            $this->container->get('session')->save();
            
            return $this->redirectToRoute('app_home');
        }
        
        // Get login error if any
        $error = $authenticationUtils->getLastAuthenticationError();
        
        // Last username entered by the user
        $lastUsername = $authenticationUtils->getLastUsername();

        return $this->render('security/login.html.twig', [
            'last_username' => $lastUsername,
            'error' => $error,
        ]);
    }
    
    #[Route('/logout', name: 'app_logout')]
    public function logout(): void
    {
        throw new \LogicException('This method can be blank - it will be intercepted by the logout key on your firewall.');
    }
    
    #[Route('/api/check-auth', name: 'api_check_auth')]
    public function checkAuth(): Response
    {
        // Jednoduché API pro kontrolu, zda je uživatel přihlášen
        if ($this->getUser()) {
            return $this->json([
                'authenticated' => true,
                'username' => $this->getUser()->getUserIdentifier(),
            ]);
        }
        
        return $this->json([
            'authenticated' => false
        ]);
    }
}
