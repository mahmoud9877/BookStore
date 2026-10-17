import userModel from "../../../DB/modules/UserModel.js";
import { asyncHandler } from "../../../src/utils/errorHandling.js";
import { generateToken } from "../../../src/utils/GenerateAndVerifyToken.js";
import { hash, compare } from "../../../src/utils/HashAndCompare.js";

export const getAll = asyncHandler(async (req, res, next) => {
  const check = await userModel.find({});
  return res.json({ message: "done", check });
});

export const signup = asyncHandler(async (req, res, next) => {
  const { userName, email, password, phone } = req.body;

  // Check if email already exists
  if (await userModel.findOne({ email: email.toLowerCase() })) {
    return next(new Error("Email already exists", { cause: 409 }));
  }

  // Check if phone number already exists
  if (await userModel.findOne({ phone })) {
    return next(new Error("Phone number already exists", { cause: 409 }));
  }

  const token = generateToken({
    payload: { email },
    signature: process.env.EMAIL_TOKEN,
    expiresIn: 60 * 5,
  });

  const refreshToken = generateToken({
    payload: { email },
    signature: process.env.EMAIL_TOKEN,
    expiresIn: 60 * 60 * 24 * 30,
  });

  const link = `${req.protocol}://${req.headers.host}/auth/confirmEmail/${token}`;
  const rfLink = `${req.protocol}://${req.headers.host}/auth/NewConfirmEmail/${refreshToken}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Confirmation</title>
    <style>
        body {
            background-color: #f4f4f4;
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            color: #333;
        }

        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border: 1px solid #ddd;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
        }

        .email-header {
            text-align: center;
            padding: 10px 0;
        }

        .email-header img {
            max-width: 100px;
        }

        .email-body {
            padding: 20px;
            text-align: center;
        }

        .email-body h1 {
            color: #630E2B;
            font-size: 24px;
            margin-bottom: 10px;
        }

        .email-body p {
            font-size: 16px;
            margin-bottom: 20px;
            color: #555;
        }

        .email-body img {
            width: 150px;
            height: 150px;
            object-fit: cover;
            border-radius: 50%;
            margin-bottom: 15px;
        }

        .confirm-button {
            background-color: #630E2B;
            color: #ffffff;
            padding: 15px 30px;
            border: none;
            border-radius: 5px;
            text-decoration: none;
            font-size: 16px;
            margin: 10px 0;
            display: inline-block;
        }

        .confirm-button:hover {
            background-color: #821b42;
        }

        .email-footer {
            margin-top: 20px;
            padding-top: 10px;
            border-top: 1px solid #ddd;
            text-align: center;
        }

        .email-footer p {
            color: #aaa;
            font-size: 14px;
        }

        .social-icons {
            margin-top: 10px;
        }

        .social-icons a {
            margin: 0 5px;
            display: inline-block;
        }

        .social-icons img {
            width: 30px;
            height: 30px;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <img src="https://res.cloudinary.com/ddajommsw/image/upload/v1670702280/Group_35052_icaysu.png" alt="Logo">
        </div>

        <div class="email-body">
            <h1>Welcome, {{userName}}!</h1>
            <p>Thank you for signing up. Please confirm your email address to complete your registration.</p>

            <!-- Display user profile image if available -->
            {{#if image}}
            <img src="{{image}}" alt="Profile Image">
            {{/if}}

            <p><strong>Your phone:</strong> {{phone}}</p>

            <a href="{{link}}" class="confirm-button">Verify Email Address</a>

            <p>If you did not sign up for this account, please ignore this email.</p>
        </div>

        <div class="email-footer">
            <p>Stay connected with us!</p>
            <div class="social-icons">
                <a href="https://www.facebook.com"><img src="https://res.cloudinary.com/ddajommsw/image/upload/v1670703402/Group35062_erj5dx.png" alt="Facebook"></a>
                <a href="https://www.twitter.com"><img src="https://res.cloudinary.com/ddajommsw/image/upload/v1670703402/Group35063_zottpo.png" alt="Twitter"></a>
                <a href="https://www.instagram.com"><img src="https://res.cloudinary.com/ddajommsw/image/upload/v1670703402/Group_35064_i8qtfd.png" alt="Instagram"></a>
            </div>
            <p>© 2024 Your Company. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
`; // Your email template remains unchanged

  // Send confirmation email
  // if (!(await sendEmail({ to: email, subject: "Confirmation-Email", html }))) {
  //   return res.status(400).json({ message: "Email rejected" });
  // }

  // Hash password
  const hashPassword = await hash({ plaintext: password });

  // Create new user
  const { _id } = await userModel.create({
    userName,
    email,
    password: hashPassword,
    phone, // Add phone to the user model
  });

  // Respond with success
  return res.status(201).json({ message: "Done", _id, refreshToken, token });
});

export const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;
  const user = await userModel.findOne({ email: email.toLowerCase() });

  if (!user) {
    return next(new Error("Email Not found", { cause: 404 }));
  }

  if (!user.confirmEmail) {
    return next(new Error("Confirm Your Email", { cause: 404 }));
  }

  if (!compare({ plaintext: password, hashValue: user.password })) {
    return next({ message: "Wrong Password", cause: 404 });
  }

  // Generate the token including the user role
  const token = generateToken({
    payload: { id: user._id, userName: user.userName, role: user.role }, // Include role here
    expiresIn: 30 * 60 * 24 * 365,
  });

  user.status = "online";
  await user.save(); // Ensure you await user.save() to handle the promise
  return res.status(200).json({ message: "Done", token, role: user.role }); // Return user role in response
});
