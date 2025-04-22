<?php

namespace App\Controller;

use App\Entity\User;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Authentication\UserAuthenticatorInterface;
use Symfony\Component\Security\Http\Authenticator\FormLoginAuthenticator;
use App\Security\LoginFormAuthenticator;

class RegistrationController extends AbstractController
{
    #[Route('/register', name: 'app_register')]
    public function register(
        Request $request, 
        UserPasswordHasherInterface $passwordHasher,
        UserAuthenticatorInterface $userAuthenticator,
        LoginFormAuthenticator $formAuthenticator,
        EntityManagerInterface $entityManager,
        UserRepository $userRepository
    ): Response
    {
        // Check if user is already logged in
        if ($this->getUser()) {
            return $this->redirectToRoute('app_home');
        }

        $error = null;

        if ($request->isMethod('POST')) {
            $username = $request->request->get('username');
            $email = $request->request->get('email');
            $password = $request->request->get('password');
            $passwordConfirm = $request->request->get('password_confirm');

            // Basic validation
            if (empty($username) || empty($email) || empty($password) || empty($passwordConfirm)) {
                $error = 'All fields are required';
            } elseif ($password !== $passwordConfirm) {
                $error = 'Passwords do not match';
            } elseif (strlen($password) < 6) {
                $error = 'Password must be at least 6 characters long';
            } elseif ($userRepository->findOneBy(['email' => $email])) {
                $error = 'Email address is already in use';
            } elseif ($userRepository->findOneBy(['username' => $username])) {
                $error = 'Username is already in use';
            } else {
                // Create new user
                $user = new User();
                $user->setUsername($username);
                $user->setEmail($email);
                $user->setPassword($passwordHasher->hashPassword($user, $password));

                $entityManager->persist($user);
                $entityManager->flush();

                // Automatically authenticate user after registration
                return $userAuthenticator->authenticateUser(
                    $user,
                    $formAuthenticator,
                    $request
                );
            }
        }

        return $this->render('security/register.html.twig', [
            'error' => $error,
        ]);
    }
}