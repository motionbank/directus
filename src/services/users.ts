import * as ItemsService from './items';
import jwt from 'jsonwebtoken';
import { sendInviteMail } from '../mail';
import database from '../database';
import argon2 from 'argon2';
import { InvalidPayloadException } from '../exceptions';
import { Accountability, Query } from '../types';

export const createUser = async (data: Record<string, any>, accountability: Accountability) => {
	return await ItemsService.createItem('directus_users', data, accountability);
};

export const readUsers = async (query?: Query) => {
	return await ItemsService.readItems('directus_users', query);
};

export const readUser = async (pk: string | number, query?: Query) => {
	return await ItemsService.readItem('directus_users', pk, query);
};

export const updateUser = async (
	pk: string | number,
	data: Record<string, any>,
	accountability: Accountability
) => {
	/**
	 * @todo
	 * Remove "other" refresh token sessions when changing password to enforce "logout everywhere" on password change
	 *
	 * Maybe make this an option?
	 */
	return await ItemsService.updateItem('directus_users', pk, data, accountability);
};

export const deleteUser = async (pk: string | number, accountability: Accountability) => {
	await ItemsService.deleteItem('directus_users', pk, accountability);
};

export const inviteUser = async (email: string, role: string, accountability: Accountability) => {
	await createUser({ email, role, status: 'invited' }, accountability);

	const payload = { email };
	const token = jwt.sign(payload, process.env.SECRET, { expiresIn: '7d' });
	const acceptURL = process.env.PUBLIC_URL + '/admin/accept-invite?token=' + token;

	await sendInviteMail(email, acceptURL);
};

export const acceptInvite = async (token: string, password: string) => {
	const { email } = jwt.verify(token, process.env.SECRET) as { email: string };
	const user = await database
		.select('id', 'status')
		.from('directus_users')
		.where({ email })
		.first();

	if (!user || user.status !== 'invited') {
		throw new InvalidPayloadException(`Email address ${email} hasn't been invited.`);
	}

	const passwordHashed = await argon2.hash(password);

	await database('directus_users')
		.update({ password: passwordHashed, status: 'active' })
		.where({ id: user.id });
};
